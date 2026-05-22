-- =========================================================================
-- LIBRO CONTABLE UNIFICADO — toda venta de telemedicina llega a accounting_ledger
-- =========================================================================
-- Antes, accounting_ledger sólo recibía ventas del marketplace. Esto suma los
-- ingresos de telemedicina (consultas, grabaciones, servicios, recargas y
-- suscripciones) al MISMO libro, para que /admin/accounting muestre TODO.
--
-- Decisiones del cliente (2026-05-21):
--   1. Comisión por tipo de venta, editable por el superadmin (payout_settings).
--   2. La comisión se contabiliza al concretarse la venta.
--   3. La plataforma factura IVA (16%) — se calcula sobre su comisión.
--
-- SEGURIDAD: los triggers son a prueba de excepciones (EXCEPTION WHEN OTHERS
-- -> RETURN). Un error contable JAMÁS bloquea un cobro: a lo sumo falta un
-- asiento, que se puede re-generar. Nunca tumba un pago.
-- =========================================================================

-- Tasa de comisión efectiva para un tipo de venta (fracción 0..1).
-- Usa el % por-tipo si el superadmin lo definió; si no, el % general.
create or replace function public.fn_commission_rate(p_kind text)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.payout_settings%rowtype;
  v numeric;
begin
  select * into s from public.payout_settings where id = 'default';
  if not found then return 0.20; end if;
  v := case p_kind
         when 'consultation' then s.commission_consultation
         when 'recording'    then s.commission_recording
         when 'live'         then s.commission_live
         when 'chat'         then s.commission_chat
         when 'content'      then s.commission_content
         else null
       end;
  v := coalesce(v, s.commission_percentage, 20);
  return round(v / 100.0, 4);
end;
$$;

-- Inserta los asientos de doble entrada de una venta de servicios médicos.
-- gross = monto bruto; v_kind = consultation|recording|live|chat|content|other
create or replace function public.fn_post_service_sale(
  p_group uuid, p_kind text, p_gross numeric, p_currency text, p_desc text, p_meta jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric;
  v_commission numeric;
  v_doctor_net numeric;
  v_iva numeric;
  v_iva_rate numeric := 0.16;
  v_cur text := coalesce(p_currency, 'MXN');
begin
  if p_gross is null or p_gross <= 0 then return; end if;

  if p_kind = 'other' then
    -- Servicio 100% de la plataforma (almacenamiento, etc.): sin parte de doctor.
    v_iva := round(p_gross * v_iva_rate / (1 + v_iva_rate), 2);
    insert into public.accounting_ledger (transaction_group, entry_type, account, amount, currency, description, metadata) values
      (p_group, 'debit',  'cash_in',          p_gross,        v_cur, p_desc, p_meta),
      (p_group, 'credit', 'revenue_platform', p_gross - v_iva,v_cur, 'Ingreso plataforma (neto de IVA)', p_meta),
      (p_group, 'credit', 'tax_iva_payable',  v_iva,          v_cur, 'IVA recaudado', p_meta);
    return;
  end if;

  v_rate       := public.fn_commission_rate(p_kind);
  v_commission := round(p_gross * v_rate, 2);
  v_doctor_net := round(p_gross - v_commission, 2);
  -- IVA incluido dentro de la comisión (la plataforma factura su comisión con IVA).
  v_iva        := round(v_commission * v_iva_rate / (1 + v_iva_rate), 2);

  insert into public.accounting_ledger (transaction_group, entry_type, account, amount, currency, description, metadata) values
    (p_group, 'debit',  'cash_in',                  p_gross,                 v_cur, p_desc, p_meta),
    (p_group, 'credit', 'revenue_platform',         v_commission - v_iva,    v_cur, 'Comisión plataforma (neta de IVA)', p_meta),
    (p_group, 'credit', 'tax_iva_payable',          v_iva,                   v_cur, 'IVA sobre comisión', p_meta),
    (p_group, 'credit', 'liability_doctor_payable', v_doctor_net,            v_cur, 'Adeudo neto al doctor', p_meta);
end;
$$;

-- =========================================================================
-- TRIGGER: wallet_transactions -> ledger
-- =========================================================================
create or replace function public.fn_ledger_wallet_txn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_gross numeric;
  v_meta jsonb;
begin
  -- Sólo transacciones efectivamente cobradas.
  if new.status is distinct from 'paid' then return new; end if;
  -- Idempotencia: un evento por transacción.
  if exists (select 1 from public.accounting_ledger where transaction_group = new.id) then
    return new;
  end if;

  v_meta := jsonb_build_object('source', 'wallet_transaction', 'wallet_txn', new.id);

  if new.type = 'topup' then
    -- Recarga de wallet: entra efectivo y se crea un pasivo (saldo del usuario).
    insert into public.accounting_ledger (transaction_group, entry_type, account, amount, currency, description, metadata) values
      (new.id, 'debit',  'cash_in',               abs(new.amount), 'MXN', 'Recarga de wallet', v_meta),
      (new.id, 'credit', 'liability_user_wallet', abs(new.amount), 'MXN', 'Saldo a favor del usuario', v_meta);
    return new;

  elsif new.type = 'purchase' then
    v_gross := abs(new.amount);
    -- El marketplace tiene su propio libro (fn_record_marketplace_earning): no duplicar.
    if (new.metadata ? 'order_id') or coalesce(new.description,'') ilike '%marketplace%' then
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
  -- Nunca bloquear el cobro por un fallo contable.
  return new;
end;
$$;

drop trigger if exists trg_ledger_wallet_txn on public.wallet_transactions;
create trigger trg_ledger_wallet_txn
  after insert or update of status on public.wallet_transactions
  for each row execute function public.fn_ledger_wallet_txn();

-- =========================================================================
-- TRIGGER: subscriptions -> ledger (suscripciones a creadores/doctores)
-- =========================================================================
create or replace function public.fn_ledger_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.price_paid, 0) <= 0 then return new; end if;
  if exists (select 1 from public.accounting_ledger where transaction_group = new.id) then
    return new;
  end if;
  perform public.fn_post_service_sale(
    new.id, 'content', new.price_paid, 'MXN',
    'Suscripción a creador',
    jsonb_build_object('source', 'subscription', 'subscription_id', new.id, 'creator_id', new.creator_id)
  );
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_ledger_subscription on public.subscriptions;
create trigger trg_ledger_subscription
  after insert on public.subscriptions
  for each row execute function public.fn_ledger_subscription();

-- =========================================================================
-- TRIGGER: ad_payments -> ledger (ingresos por publicidad, 100% plataforma)
-- =========================================================================
create or replace function public.fn_ledger_ad_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from 'paid' then return new; end if;
  if exists (select 1 from public.accounting_ledger where transaction_group = new.id) then
    return new;
  end if;
  perform public.fn_post_service_sale(
    new.id, 'other', new.amount, 'MXN', 'Ingreso por publicidad',
    jsonb_build_object('source', 'ad_payment', 'ad_payment_id', new.id, 'campaign_id', new.campaign_id)
  );
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_ledger_ad_payment on public.ad_payments;
create trigger trg_ledger_ad_payment
  after insert or update of status on public.ad_payments
  for each row execute function public.fn_ledger_ad_payment();
