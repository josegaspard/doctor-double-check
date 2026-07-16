-- =========================================================================
-- Endurecimiento de seguridad 2026-07-16 (auditoría adversarial MEGA)
-- Idempotente. SOLO endurece (no crea acceso nuevo). Aplicable a prod tal cual.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1) P0 — Bypass total del paywall: cualquier autenticado se auto-insertaba
--    una fila en public.purchases (amount:0) y desbloqueaba grabaciones/libros/PDF.
--    Las compras deben crearse SOLO por service_role (stripe-webhook / purchase-*)
--    tras confirmar el cobro. El frontend NUNCA inserta purchases (solo SELECT),
--    verificado en src/src/**. Quitamos el INSERT del cliente.
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create purchases" ON public.purchases;
-- La policy VIVA en prod (drift, fuera de migraciones) era "Users can create own
-- paid purchases" con WITH CHECK (auth.uid()=user_id AND amount>0 AND recording_id/content_id).
-- Sigue siendo explotable: exige amount>0 pero NO que exista un pago real → un atacante
-- inserta amount:0.01 y desbloquea contenido de pago sin pagar. Se elimina también.
DROP POLICY IF EXISTS "Users can create own paid purchases" ON public.purchases;
-- (No se recrea ninguna policy de INSERT para 'authenticated'. Las compras las crean
--  SOLO las edge functions con service_role tras confirmar el cobro.)

-- -------------------------------------------------------------------------
-- 2) P1 — get_accounting_summary: SECURITY DEFINER sin control de rol → cualquier
--    autenticado leía el libro mayor global (débitos/créditos/saldos de todo).
--    Ahora exige rol admin. Firma idéntica (AdminAccounting.tsx sigue funcionando).
-- -------------------------------------------------------------------------
create or replace function public.get_accounting_summary(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  account text,
  total_debit numeric,
  total_credit numeric,
  balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not_authorized';
  end if;
  return query
    select
      al.account,
      sum(case when al.entry_type = 'debit' then al.amount else 0 end) as total_debit,
      sum(case when al.entry_type = 'credit' then al.amount else 0 end) as total_credit,
      sum(case when al.entry_type = 'debit' then al.amount else -al.amount end) as balance
    from public.accounting_ledger al
    where (p_from is null or al.created_at >= p_from)
      and (p_to is null or al.created_at < p_to)
    group by al.account
    order by al.account;
end;
$$;
revoke all on function public.get_accounting_summary(timestamptz, timestamptz) from public;
grant execute on function public.get_accounting_summary(timestamptz, timestamptz) to authenticated;

-- -------------------------------------------------------------------------
-- 3) P1 — get_vendor_payout_balance: SECURITY DEFINER sin scope → cualquier
--    autenticado leía stripe_account_id + saldos de TODOS los vendors (p_vendor_id
--    default null devolvía todo). Ahora: admin ve todos; cada vendor ve SOLO
--    su(s) vendor(es) (v.user_id = auth.uid()). VendorEarnings.tsx y AdminMarketplace.tsx
--    siguen funcionando (el vendor pasa su propio id; el admin no pasa id).
-- -------------------------------------------------------------------------
create or replace function public.get_vendor_payout_balance(p_vendor_id uuid default null)
returns table (
  vendor_id uuid,
  vendor_name text,
  stripe_account_id text,
  payouts_enabled boolean,
  pending_count integer,
  pending_amount numeric,
  available_count integer,
  available_amount numeric,
  total_paid numeric
)
language sql
security definer
set search_path = public
as $$
  select
    v.id as vendor_id,
    v.name as vendor_name,
    v.stripe_account_id,
    v.stripe_payouts_enabled as payouts_enabled,
    count(case when e.status = 'pending' and (e.available_at is null or e.available_at > now()) then 1 end)::int as pending_count,
    coalesce(sum(case when e.status = 'pending' and (e.available_at is null or e.available_at > now()) then e.net_amount end), 0) as pending_amount,
    count(case when e.status = 'pending' and e.available_at <= now() then 1 end)::int as available_count,
    coalesce(sum(case when e.status = 'pending' and e.available_at <= now() then e.net_amount end), 0) as available_amount,
    coalesce(sum(case when e.status = 'paid' then e.net_amount end), 0) as total_paid
  from public.marketplace_vendors v
  left join public.vendor_earnings e on e.vendor_id = v.id
  where (public.has_role(auth.uid(), 'admin') or v.user_id = auth.uid())
    and (p_vendor_id is null or v.id = p_vendor_id)
  group by v.id, v.name, v.stripe_account_id, v.stripe_payouts_enabled
  order by available_amount desc nulls last;
$$;
revoke all on function public.get_vendor_payout_balance(uuid) from public;
grant execute on function public.get_vendor_payout_balance(uuid) to authenticated;
