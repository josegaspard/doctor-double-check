-- =========================================================================
-- MARKETPLACE V2 — Refunds, Disputes, Stock, Comisiones, Shipping granular,
-- Tracking, Reviews, Audit, Vendor Stripe Connect, Vendor Earnings, Payouts,
-- Accounting Ledger.
-- =========================================================================

-- =========================================================================
-- 1. EXTEND EXISTING TABLES
-- =========================================================================

-- marketplace_vendors → Stripe Connect + comisión + datos fiscales
alter table public.marketplace_vendors
  add column if not exists stripe_account_id text,
  add column if not exists stripe_payouts_enabled boolean not null default false,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists commission_rate numeric(5,4) not null default 0.15,
  add column if not exists iva_rate numeric(5,4) not null default 0.16,
  add column if not exists tax_id text,
  add column if not exists legal_name text,
  add column if not exists payout_email text,
  add column if not exists notes text;

comment on column public.marketplace_vendors.commission_rate is
  'Comisión plataforma sobre venta bruta (0.15 = 15%)';
comment on column public.marketplace_vendors.iva_rate is
  'Tasa IVA aplicable (0.16 = 16% MX)';

-- marketplace_products → stock tracking + total vendido + sku
alter table public.marketplace_products
  add column if not exists track_stock boolean not null default true,
  add column if not exists low_stock_threshold integer not null default 5,
  add column if not exists total_sold integer not null default 0,
  add column if not exists sku text,
  add column if not exists weight_grams integer;

-- marketplace_orders → shipping granular + tracking + refund status + logs
alter table public.marketplace_orders
  add column if not exists shipping_status text not null default 'pending',
  add column if not exists courier_name text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists refund_status text not null default 'none',
  add column if not exists refunded_amount numeric(12,2) not null default 0,
  add column if not exists dispute_status text not null default 'none',
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id),
  add column if not exists shipped_by uuid references auth.users(id),
  add column if not exists fulfillment_log jsonb not null default '[]'::jsonb,
  add column if not exists currency text not null default 'MXN',
  add column if not exists subtotal numeric(12,2),
  add column if not exists shipping_cost numeric(12,2) not null default 0,
  add column if not exists tax_amount numeric(12,2) not null default 0,
  add column if not exists platform_fee numeric(12,2),
  add column if not exists vendor_net numeric(12,2),
  add column if not exists stripe_fee numeric(12,2),
  add column if not exists stripe_payment_intent_id text,
  add column if not exists earning_recorded boolean not null default false;

-- shipping_status valores: pending | preparing | packed | shipped | in_transit | delivered | returned | claim
-- refund_status valores: none | requested | approved | rejected | processing | refunded | partial
-- dispute_status valores: none | warning_needs_response | needs_response | under_review | won | lost

-- =========================================================================
-- 2. VENDOR EARNINGS — cada order paid genera un earning
-- =========================================================================
create table if not exists public.vendor_earnings (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.marketplace_vendors(id) on delete cascade,
  order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  gross_amount numeric(12,2) not null,
  commission_rate numeric(5,4) not null,
  platform_fee numeric(12,2) not null,
  stripe_fee numeric(12,2) not null default 0,
  net_amount numeric(12,2) not null,
  currency text not null default 'MXN',
  status text not null default 'pending', -- pending | reserved | paid | refunded | cancelled
  payout_id uuid,
  available_at timestamptz, -- cuándo es elegible para payout (ej 14 días)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id)
);
create index if not exists idx_vendor_earnings_vendor on public.vendor_earnings(vendor_id);
create index if not exists idx_vendor_earnings_status on public.vendor_earnings(status);
create index if not exists idx_vendor_earnings_payout on public.vendor_earnings(payout_id);

alter table public.vendor_earnings enable row level security;
create policy vendor_earnings_self_read on public.vendor_earnings for select using (
  vendor_id in (select id from public.marketplace_vendors where user_id = auth.uid())
  or public.has_role(auth.uid(), 'admin')
);
create policy vendor_earnings_admin_all on public.vendor_earnings for all to authenticated using (
  public.has_role(auth.uid(), 'admin')
) with check (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- 3. VENDOR PAYOUTS — grupo de earnings pagados juntos
-- =========================================================================
create table if not exists public.vendor_payouts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.marketplace_vendors(id) on delete cascade,
  total_amount numeric(12,2) not null,
  currency text not null default 'MXN',
  earnings_count integer not null default 0,
  stripe_transfer_id text,
  stripe_payout_id text,
  status text not null default 'pending', -- pending | processing | paid | failed | reversed
  failure_reason text,
  initiated_by uuid references auth.users(id),
  initiated_at timestamptz not null default now(),
  paid_at timestamptz,
  failed_at timestamptz,
  notes text,
  receipt_url text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_vendor_payouts_vendor on public.vendor_payouts(vendor_id);
create index if not exists idx_vendor_payouts_status on public.vendor_payouts(status);

alter table public.vendor_payouts enable row level security;
create policy vendor_payouts_self_read on public.vendor_payouts for select using (
  vendor_id in (select id from public.marketplace_vendors where user_id = auth.uid())
  or public.has_role(auth.uid(), 'admin')
);
create policy vendor_payouts_admin_all on public.vendor_payouts for all to authenticated using (
  public.has_role(auth.uid(), 'admin')
) with check (public.has_role(auth.uid(), 'admin'));

-- FK earnings → payouts (deferred porque vendor_payouts se crea después)
alter table public.vendor_earnings
  drop constraint if exists vendor_earnings_payout_fk;
alter table public.vendor_earnings
  add constraint vendor_earnings_payout_fk
  foreign key (payout_id) references public.vendor_payouts(id) on delete set null;

-- =========================================================================
-- 4. ORDER REFUNDS
-- =========================================================================
create table if not exists public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  requested_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  amount numeric(12,2) not null,
  currency text not null default 'MXN',
  reason text not null,
  reason_category text not null default 'other', -- damaged | not_received | wrong_item | not_as_described | changed_mind | other
  status text not null default 'requested', -- requested | approved | rejected | processing | refunded | failed
  stripe_refund_id text,
  customer_evidence jsonb default '[]'::jsonb,
  admin_notes text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  refunded_at timestamptz
);
create index if not exists idx_order_refunds_order on public.order_refunds(order_id);
create index if not exists idx_order_refunds_status on public.order_refunds(status);

alter table public.order_refunds enable row level security;
create policy order_refunds_buyer_read on public.order_refunds for select using (
  order_id in (select id from public.marketplace_orders where buyer_id = auth.uid())
  or public.has_role(auth.uid(), 'admin')
);
create policy order_refunds_buyer_insert on public.order_refunds for insert to authenticated with check (
  order_id in (select id from public.marketplace_orders where buyer_id = auth.uid())
);
create policy order_refunds_admin_all on public.order_refunds for all to authenticated using (
  public.has_role(auth.uid(), 'admin')
) with check (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- 5. ORDER DISPUTES (Stripe chargebacks)
-- =========================================================================
create table if not exists public.order_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.marketplace_orders(id) on delete set null,
  stripe_dispute_id text not null unique,
  stripe_charge_id text,
  amount numeric(12,2) not null,
  currency text not null default 'MXN',
  reason text,
  status text not null, -- warning_needs_response | warning_under_review | warning_closed | needs_response | under_review | won | lost
  evidence_due_by timestamptz,
  evidence_submitted_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_order_disputes_status on public.order_disputes(status);

alter table public.order_disputes enable row level security;
create policy order_disputes_admin_all on public.order_disputes for all to authenticated using (
  public.has_role(auth.uid(), 'admin')
) with check (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- 6. SHIPMENT TRACKING EVENTS
-- =========================================================================
create table if not exists public.shipment_tracking_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  status text not null, -- created | picked_up | in_transit | out_for_delivery | delivered | exception | returned
  location text,
  description text,
  occurred_at timestamptz not null default now(),
  source text not null default 'manual', -- manual | webhook
  raw jsonb default '{}'::jsonb
);
create index if not exists idx_shipment_tracking_order on public.shipment_tracking_events(order_id);

alter table public.shipment_tracking_events enable row level security;
create policy shipment_events_buyer_read on public.shipment_tracking_events for select using (
  order_id in (select id from public.marketplace_orders where buyer_id = auth.uid())
  or order_id in (select o.id from public.marketplace_orders o
                  join public.marketplace_vendors v on v.id = o.vendor_id
                  where v.user_id = auth.uid())
  or public.has_role(auth.uid(), 'admin')
);
create policy shipment_events_vendor_admin_write on public.shipment_tracking_events for insert to authenticated with check (
  order_id in (select o.id from public.marketplace_orders o
               join public.marketplace_vendors v on v.id = o.vendor_id
               where v.user_id = auth.uid())
  or public.has_role(auth.uid(), 'admin')
);

-- =========================================================================
-- 7. PRODUCT REVIEWS
-- =========================================================================
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  order_id uuid references public.marketplace_orders(id) on delete set null,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text,
  verified_purchase boolean not null default false,
  vendor_reply text,
  vendor_reply_at timestamptz,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, reviewer_id)
);
create index if not exists idx_product_reviews_product on public.product_reviews(product_id);
create index if not exists idx_product_reviews_reviewer on public.product_reviews(reviewer_id);

alter table public.product_reviews enable row level security;
create policy product_reviews_public_read on public.product_reviews for select using (is_hidden = false);
create policy product_reviews_self_write on public.product_reviews for insert to authenticated with check (reviewer_id = auth.uid());
create policy product_reviews_self_update on public.product_reviews for update to authenticated using (reviewer_id = auth.uid());
create policy product_reviews_admin_all on public.product_reviews for all to authenticated using (
  public.has_role(auth.uid(), 'admin')
) with check (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- 8. MARKETPLACE AUDIT LOG
-- =========================================================================
create table if not exists public.marketplace_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  actor_role text,
  action text not null, -- order.ship | order.cancel | refund.approve | refund.reject | payout.initiate | product.update | vendor.approve | etc
  entity_type text not null,
  entity_id uuid,
  diff jsonb default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_action on public.marketplace_audit_log(action);
create index if not exists idx_audit_entity on public.marketplace_audit_log(entity_type, entity_id);
create index if not exists idx_audit_actor on public.marketplace_audit_log(actor_id);

alter table public.marketplace_audit_log enable row level security;
create policy audit_admin_all on public.marketplace_audit_log for all to authenticated using (
  public.has_role(auth.uid(), 'admin')
) with check (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- 9. ACCOUNTING LEDGER — doble entrada simplificada
-- =========================================================================
create table if not exists public.accounting_ledger (
  id uuid primary key default gen_random_uuid(),
  transaction_group uuid not null, -- agrupa los asientos de un mismo evento
  entry_type text not null, -- debit | credit
  account text not null, -- cash_stripe | revenue_gross | revenue_platform | liability_vendor_payable | expense_stripe_fee | tax_iva_payable | refund_expense | dispute_loss | etc
  amount numeric(12,2) not null,
  currency text not null default 'MXN',
  order_id uuid references public.marketplace_orders(id) on delete set null,
  vendor_id uuid references public.marketplace_vendors(id) on delete set null,
  refund_id uuid references public.order_refunds(id) on delete set null,
  payout_id uuid references public.vendor_payouts(id) on delete set null,
  dispute_id uuid references public.order_disputes(id) on delete set null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_ledger_group on public.accounting_ledger(transaction_group);
create index if not exists idx_ledger_account on public.accounting_ledger(account);
create index if not exists idx_ledger_created on public.accounting_ledger(created_at desc);
create index if not exists idx_ledger_vendor on public.accounting_ledger(vendor_id);
create index if not exists idx_ledger_order on public.accounting_ledger(order_id);

alter table public.accounting_ledger enable row level security;
create policy ledger_admin_all on public.accounting_ledger for all to authenticated using (
  public.has_role(auth.uid(), 'admin')
) with check (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- 10. TRIGGER: marketplace_order → vendor_earning + ledger asientos
-- =========================================================================
create or replace function public.fn_record_marketplace_earning()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commission_rate numeric;
  v_iva_rate numeric;
  v_platform_fee numeric;
  v_stripe_fee numeric;
  v_net numeric;
  v_gross numeric;
  v_iva numeric;
  v_group uuid;
begin
  -- Solo procesa al transicionar a paid (o estados terminales que implican cobro completado)
  if (new.status not in ('paid', 'processing', 'shipped', 'delivered'))
     or (old.status = new.status)
     or new.earning_recorded = true
     or new.vendor_id is null
  then
    return new;
  end if;

  -- Si ya hay earning para este order, salir
  if exists (select 1 from public.vendor_earnings where order_id = new.id) then
    update public.marketplace_orders set earning_recorded = true where id = new.id;
    return new;
  end if;

  select commission_rate, iva_rate into v_commission_rate, v_iva_rate
  from public.marketplace_vendors where id = new.vendor_id;

  if v_commission_rate is null then v_commission_rate := 0.15; end if;
  if v_iva_rate is null then v_iva_rate := 0.16; end if;

  v_gross := coalesce(new.subtotal, new.total_amount - coalesce(new.shipping_cost,0) - coalesce(new.tax_amount,0));
  if v_gross is null or v_gross <= 0 then v_gross := new.total_amount; end if;

  v_iva := coalesce(new.tax_amount, 0);
  -- Stripe fee MX: 3.6% + 3 MXN aprox (estimación)
  v_stripe_fee := case
    when new.payment_method = 'stripe' then round( (new.total_amount * 0.036 + 3)::numeric, 2)
    else 0
  end;
  v_platform_fee := round((v_gross * v_commission_rate)::numeric, 2);
  v_net := round((v_gross - v_platform_fee)::numeric, 2);

  insert into public.vendor_earnings (
    vendor_id, order_id, gross_amount, commission_rate,
    platform_fee, stripe_fee, net_amount, currency, status, available_at
  ) values (
    new.vendor_id, new.id, v_gross, v_commission_rate,
    v_platform_fee, v_stripe_fee, v_net, coalesce(new.currency,'MXN'),
    'pending', now() + interval '14 days'
  );

  -- Asientos contables doble entrada
  v_group := gen_random_uuid();

  insert into public.accounting_ledger (transaction_group, entry_type, account, amount, currency, order_id, vendor_id, description)
  values
    -- Debit: efectivo bruto entrante (Stripe)
    (v_group, 'debit',  'cash_stripe',             new.total_amount, coalesce(new.currency,'MXN'), new.id, new.vendor_id, 'Venta marketplace bruta'),
    -- Credit: ingreso bruto (incluye plataforma+vendor)
    (v_group, 'credit', 'revenue_gross',           v_gross,          coalesce(new.currency,'MXN'), new.id, new.vendor_id, 'Ingreso bruto'),
    -- Credit: IVA por pagar
    (v_group, 'credit', 'tax_iva_payable',         v_iva,            coalesce(new.currency,'MXN'), new.id, new.vendor_id, 'IVA recaudado'),
    -- Credit: envío recaudado (pasa al vendor o se queda)
    (v_group, 'credit', 'shipping_collected',      coalesce(new.shipping_cost,0), coalesce(new.currency,'MXN'), new.id, new.vendor_id, 'Envío cobrado al cliente'),
    -- Debit: ingreso plataforma (comisión)
    (v_group, 'credit', 'revenue_platform',        v_platform_fee,   coalesce(new.currency,'MXN'), new.id, new.vendor_id, 'Comisión plataforma'),
    -- Credit: cuenta por pagar al vendor (pasivo)
    (v_group, 'credit', 'liability_vendor_payable', v_net,           coalesce(new.currency,'MXN'), new.id, new.vendor_id, 'Adeudo neto a vendor'),
    -- Debit: gasto fee Stripe
    (v_group, 'debit',  'expense_stripe_fee',      v_stripe_fee,     coalesce(new.currency,'MXN'), new.id, new.vendor_id, 'Comisión Stripe estimada');

  update public.marketplace_orders
    set platform_fee = v_platform_fee,
        vendor_net = v_net,
        stripe_fee = v_stripe_fee,
        earning_recorded = true
    where id = new.id;

  -- Reduce stock + total_sold
  if new.product_id is not null then
    update public.marketplace_products
      set stock = greatest(0, stock - coalesce(new.quantity, 1)),
          total_sold = total_sold + coalesce(new.quantity, 1),
          updated_at = now()
      where id = new.product_id and track_stock = true;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_record_marketplace_earning on public.marketplace_orders;
create trigger trg_record_marketplace_earning
  after update of status on public.marketplace_orders
  for each row execute function public.fn_record_marketplace_earning();

-- =========================================================================
-- 11. TRIGGER: refund refunded → reversar asientos
-- =========================================================================
create or replace function public.fn_record_refund_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group uuid;
  v_order public.marketplace_orders%rowtype;
  v_vendor_id uuid;
  v_commission_rate numeric;
  v_platform_refund numeric;
  v_vendor_refund numeric;
begin
  if new.status <> 'refunded' or (old.status = 'refunded') then
    return new;
  end if;

  select * into v_order from public.marketplace_orders where id = new.order_id;
  v_vendor_id := v_order.vendor_id;

  select commission_rate into v_commission_rate from public.marketplace_vendors where id = v_vendor_id;
  if v_commission_rate is null then v_commission_rate := 0.15; end if;

  v_platform_refund := round((new.amount * v_commission_rate)::numeric, 2);
  v_vendor_refund := round((new.amount - v_platform_refund)::numeric, 2);

  v_group := gen_random_uuid();

  insert into public.accounting_ledger (transaction_group, entry_type, account, amount, currency, order_id, vendor_id, refund_id, description)
  values
    (v_group, 'credit', 'cash_stripe',              new.amount,        new.currency, new.order_id, v_vendor_id, new.id, 'Refund emitido vía Stripe'),
    (v_group, 'debit',  'refund_expense',           v_platform_refund, new.currency, new.order_id, v_vendor_id, new.id, 'Refund a cargo de plataforma'),
    (v_group, 'debit',  'liability_vendor_payable', v_vendor_refund,   new.currency, new.order_id, v_vendor_id, new.id, 'Refund a cargo de vendor (descuenta su saldo)');

  -- Ajustar earning si existe
  update public.vendor_earnings
    set status = case when new.amount >= gross_amount then 'refunded' else status end,
        net_amount = greatest(0, net_amount - v_vendor_refund),
        updated_at = now()
    where order_id = new.order_id;

  -- Update order refund_status + refunded_amount
  update public.marketplace_orders
    set refund_status = case when new.amount >= total_amount then 'refunded' else 'partial' end,
        refunded_amount = refunded_amount + new.amount,
        updated_at = now()
    where id = new.order_id;

  return new;
end;
$$;

drop trigger if exists trg_record_refund_ledger on public.order_refunds;
create trigger trg_record_refund_ledger
  after update of status on public.order_refunds
  for each row execute function public.fn_record_refund_ledger();

-- =========================================================================
-- 12. TRIGGER: payout paid → reclasificar liability → cash_out
-- =========================================================================
create or replace function public.fn_record_payout_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group uuid;
begin
  if new.status <> 'paid' or (old.status = 'paid') then
    return new;
  end if;

  v_group := gen_random_uuid();

  insert into public.accounting_ledger (transaction_group, entry_type, account, amount, currency, vendor_id, payout_id, description)
  values
    (v_group, 'debit',  'liability_vendor_payable', new.total_amount, new.currency, new.vendor_id, new.id, 'Payout pagado a vendor'),
    (v_group, 'credit', 'cash_stripe',              new.total_amount, new.currency, new.vendor_id, new.id, 'Salida de efectivo (Stripe transfer)');

  -- Marca earnings asociadas como paid
  update public.vendor_earnings
    set status = 'paid', updated_at = now()
    where payout_id = new.id;

  return new;
end;
$$;

drop trigger if exists trg_record_payout_ledger on public.vendor_payouts;
create trigger trg_record_payout_ledger
  after update of status on public.vendor_payouts
  for each row execute function public.fn_record_payout_ledger();

-- =========================================================================
-- 13. RPC: get_accounting_summary (rango de fechas)
-- =========================================================================
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
language sql
security definer
set search_path = public
as $$
  select
    account,
    sum(case when entry_type = 'debit' then amount else 0 end) as total_debit,
    sum(case when entry_type = 'credit' then amount else 0 end) as total_credit,
    sum(case when entry_type = 'debit' then amount else -amount end) as balance
  from public.accounting_ledger
  where (p_from is null or created_at >= p_from)
    and (p_to is null or created_at < p_to)
  group by account
  order by account;
$$;

revoke all on function public.get_accounting_summary(timestamptz, timestamptz) from public;
grant execute on function public.get_accounting_summary(timestamptz, timestamptz) to authenticated;

-- =========================================================================
-- 14. RPC: get_vendor_payout_balance (saldo pendiente por vendor)
-- =========================================================================
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
  where (p_vendor_id is null or v.id = p_vendor_id)
  group by v.id, v.name, v.stripe_account_id, v.stripe_payouts_enabled
  order by available_amount desc nulls last;
$$;

revoke all on function public.get_vendor_payout_balance(uuid) from public;
grant execute on function public.get_vendor_payout_balance(uuid) to authenticated;
