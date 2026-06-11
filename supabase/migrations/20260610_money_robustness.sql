-- =========================================================================
-- 2026-06-10 — Robustez de dinero: idempotencia anti doble-cobro + contabilidad
-- de double_check + reverso contable de reembolsos (no-marketplace).
-- =========================================================================

begin;

-- 1) IDEMPOTENCIA en process_wallet_purchase ------------------------------
--    Param opcional p_idempotency_key (compatible hacia atrás: 3 args sigue
--    funcionando). El lock del wallet va PRIMERO → serializa las compras del
--    usuario → el chequeo de idempotencia es race-safe (una llamada concurrente
--    previa ya commiteó y su fila es visible).
create or replace function public.process_wallet_purchase(
  p_amount numeric,
  p_description text,
  p_metadata jsonb default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid;
  v_current_balance numeric;
  v_final_amount numeric;
  v_prev numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return jsonb_build_object('success', false, 'error', 'No authenticated user'); end if;
  if p_amount <= 0 then return jsonb_build_object('success', false, 'error', 'Invalid amount'); end if;

  -- Lock primero (serializa por usuario).
  select balance into v_current_balance from wallets where user_id = v_user_id for update;
  if not found then return jsonb_build_object('success', false, 'error', 'Wallet not found'); end if;

  -- Replay idempotente: misma key ya cobrada → devolver sin volver a cobrar.
  if p_idempotency_key is not null then
    select abs(amount) into v_prev from wallet_transactions
      where user_id = v_user_id and type = 'purchase'
        and metadata->>'idempotency_key' = p_idempotency_key
      limit 1;
    if found then
      return jsonb_build_object('success', true, 'amount_charged', v_prev,
                                'new_balance', v_current_balance, 'idempotent_replay', true);
    end if;
  end if;

  v_final_amount := get_price_for_user(p_amount, v_user_id);
  if v_current_balance < v_final_amount then return jsonb_build_object('success', false, 'error', 'Insufficient balance'); end if;

  insert into wallet_transactions (user_id, type, amount, description, status, metadata)
  values (v_user_id, 'purchase', -v_final_amount, p_description, 'paid',
          case when p_idempotency_key is null then p_metadata
               else coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('idempotency_key', p_idempotency_key) end);

  update wallets set balance = balance - v_final_amount, updated_at = now() where user_id = v_user_id;
  return jsonb_build_object('success', true, 'amount_charged', v_final_amount, 'new_balance', v_current_balance - v_final_amount);
end;
$$;

-- Índice único de defensa (por usuario+key).
create unique index if not exists ux_wallet_txn_idempotency
  on public.wallet_transactions (user_id, (metadata->>'idempotency_key'))
  where metadata ? 'idempotency_key';

-- 2) IDEMPOTENCIA en process_double_check_purchase ------------------------
create or replace function public.process_double_check_purchase(
  p_doctor_id uuid,
  p_amount numeric,
  p_description text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid;
  v_current_balance numeric;
  v_final_amount numeric;
  v_doctor_status text;
  v_prev numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return jsonb_build_object('success', false, 'error', 'No authenticated user'); end if;
  if p_amount <= 0 or p_amount > 50000 then return jsonb_build_object('success', false, 'error', 'Invalid amount'); end if;

  select status into v_doctor_status from doctor_profiles where user_id = p_doctor_id;
  if v_doctor_status is distinct from 'approved' then return jsonb_build_object('success', false, 'error', 'Doctor not available'); end if;

  select balance into v_current_balance from wallets where user_id = v_user_id for update;
  if not found then return jsonb_build_object('success', false, 'error', 'Wallet not found'); end if;

  if p_idempotency_key is not null then
    select abs(amount) into v_prev from wallet_transactions
      where user_id = v_user_id and type = 'purchase'
        and metadata->>'idempotency_key' = p_idempotency_key
      limit 1;
    if found then
      return jsonb_build_object('success', true, 'amount_charged', v_prev,
                                'new_balance', v_current_balance, 'idempotent_replay', true);
    end if;
  end if;

  v_final_amount := get_price_for_user(p_amount, v_user_id);
  if v_current_balance < v_final_amount then return jsonb_build_object('success', false, 'error', 'Insufficient balance'); end if;

  insert into wallet_transactions (user_id, type, amount, description, status, metadata)
  values (v_user_id, 'purchase', -v_final_amount, p_description, 'paid',
    jsonb_build_object('type','double_check','doctor_id',p_doctor_id)
      || case when p_idempotency_key is null then '{}'::jsonb else jsonb_build_object('idempotency_key', p_idempotency_key) end);

  update wallets set balance = balance - v_final_amount, updated_at = now() where user_id = v_user_id;

  update doctor_profiles set pending_earnings = coalesce(pending_earnings, 0) + v_final_amount where user_id = p_doctor_id;

  insert into wallet_transactions (user_id, type, amount, description, status, metadata)
  values (p_doctor_id, 'earning', v_final_amount, 'Ganancia por Segunda Opinión', 'paid',
    jsonb_build_object('source','double_check','patient_id',v_user_id));

  return jsonb_build_object('success', true, 'amount_charged', v_final_amount, 'new_balance', v_current_balance - v_final_amount);
end;
$$;

-- 3) CONTABILIDAD: double_check + reverso de reembolsos -------------------
create or replace function public.fn_ledger_wallet_txn()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
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
    -- Segunda opinión (double_check): el doctor recibe el 100% (sin comisión).
    if (new.metadata->>'type') = 'double_check' then
      insert into public.accounting_ledger (transaction_group, entry_type, account, amount, currency, description, metadata) values
        (new.id, 'debit',  'cash_in',                  v_gross, 'MXN', coalesce(new.description, 'Segunda opinión'), v_meta),
        (new.id, 'credit', 'liability_doctor_payable', v_gross, 'MXN', 'Adeudo al doctor (segunda opinión, 100%)', v_meta);
      return new;
    end if;
    if (new.metadata->>'type') = 'consultation' then
      v_kind := 'consultation';
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
$$;

commit;
