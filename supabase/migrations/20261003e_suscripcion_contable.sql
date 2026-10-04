-- 20261003e: las compras de suscripción (alta y renovación) se asientan como 'subscription' con su comisión
-- (antes caían en 'other': 100 % ingreso de la plataforma y sin adeudo al médico). Copia de la función viva + 2 líneas.
CREATE OR REPLACE FUNCTION public.fn_ledger_wallet_txn()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_kind text;
  v_gross numeric;
  v_meta jsonb;
  v_orig text;
  v_orig_total numeric;
  v_ratio numeric;
  v_iva numeric;
begin
  if new.status is distinct from 'paid' then return new; end if;
  if exists (select 1 from public.accounting_ledger where transaction_group = new.id) then
    return new;
  end if;

  v_meta := jsonb_build_object('source', 'wallet_transaction', 'wallet_txn', new.id);

  if new.type = 'topup' then
    insert into public.accounting_ledger (transaction_group, entry_type, account, amount, currency, description, metadata) values
      (new.id, 'debit',  'cash_in',               abs(new.amount), 'MXN', 'Recarga de wallet', v_meta),
      (new.id, 'credit', 'liability_user_wallet', abs(new.amount), 'MXN', 'Saldo a favor del usuario', v_meta);
    return new;

  elsif new.type = 'refund' then
    -- El marketplace tiene su propio libro; sus reembolsos se revierten allí.
    if (new.metadata->>'source') = 'marketplace' or (new.metadata ? 'order_id') then
      return new;
    end if;
    v_gross := abs(new.amount);
    v_orig := new.metadata->>'original_transaction_id';
    -- Si se conoce la venta original, revertir su asiento EXACTO (proporcional a
    -- reembolsos parciales) volteando debe/haber → siempre cuadra.
    if v_orig is not null and exists (select 1 from public.accounting_ledger where transaction_group = v_orig::uuid) then
      select sum(amount) into v_orig_total from public.accounting_ledger
        where transaction_group = v_orig::uuid and entry_type = 'debit';
      v_ratio := case when coalesce(v_orig_total, 0) > 0 then least(1.0, v_gross / v_orig_total) else 1.0 end;
      insert into public.accounting_ledger (transaction_group, entry_type, account, amount, currency, description, metadata)
        select new.id,
               case when entry_type = 'debit' then 'credit' else 'debit' end,
               account, round(amount * v_ratio, 2), currency,
               'Reverso por reembolso', v_meta || jsonb_build_object('reverses', v_orig)
        from public.accounting_ledger where transaction_group = v_orig::uuid;
      return new;
    end if;
    -- Fallback genérico: salida de caja, revertir ingreso plataforma + IVA.
    v_iva := round(v_gross * 0.16 / 1.16, 2);
    insert into public.accounting_ledger (transaction_group, entry_type, account, amount, currency, description, metadata) values
      (new.id, 'debit',  'revenue_platform', v_gross - v_iva, 'MXN', 'Reverso ingreso por reembolso', v_meta),
      (new.id, 'debit',  'tax_iva_payable',  v_iva,           'MXN', 'Reverso IVA por reembolso', v_meta),
      (new.id, 'credit', 'cash_in',          v_gross,         'MXN', 'Salida de caja por reembolso', v_meta);
    return new;

  elsif new.type = 'purchase' then
    v_gross := abs(new.amount);
    -- El marketplace tiene su propio libro (fn_record_marketplace_earning).
    if (new.metadata ? 'order_id')
       or (new.metadata->>'source' = 'marketplace')
       or coalesce(new.description,'') ilike '%marketplace%' then
      return new;
    end if;
    -- Consulta, segunda opinión y orientación desde live: comisión 'consultation' (lo que se
    -- acredita al médico con tarjeta y con saldo).
    if (new.metadata->>'type') in ('consultation', 'double_check', 'live_consultation') then
      v_kind := 'consultation';
    elsif (new.metadata->>'type') = 'live_chat_highlight' then
      v_kind := 'live_chat_highlight';
    elsif (new.metadata->>'type') in ('subscription', 'subscription_renewal') then
      v_kind := 'subscription';
    elsif new.metadata ? 'content_id' then
      v_kind := 'content';
    elsif (new.metadata ? 'recording_id') or coalesce(new.description,'') ilike 'grabaci%' then
      v_kind := 'recording';
    else
      v_kind := 'other';
    end if;
    perform public.fn_post_service_sale(
      new.id, v_kind, v_gross, 'MXN',
      coalesce(new.description, 'Venta de servicio'),
      v_meta || jsonb_build_object('kind', v_kind)
    );
    return new;
  end if;

  return new;
exception when others then
  return new;
end;
$function$

;
