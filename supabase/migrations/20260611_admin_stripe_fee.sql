-- Make the Stripe processing fee (was hardcoded 3.6% + $3 in fn_record_marketplace_earning)
-- admin-editable via payout_settings. DEFAULT 3.6 / 3 = current behavior; adding the
-- columns with a default backfills the existing 'default' row, so nothing changes
-- until an admin edits it.
alter table public.payout_settings add column if not exists stripe_fee_pct numeric not null default 3.6;
alter table public.payout_settings add column if not exists stripe_fee_fixed numeric not null default 3;

create or replace function public.fn_record_marketplace_earning()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_commission_rate numeric;
  v_platform_fee numeric;
  v_stripe_fee numeric;
  v_net numeric;
  v_gross numeric;
  v_iva numeric;
  v_shipping numeric;
  v_cash_net numeric;
  v_group uuid;
  v_fee_pct numeric;
  v_fee_fixed numeric;
begin
  if (new.status not in ('paid', 'processing', 'shipped', 'delivered'))
     or (old.status = new.status)
     or new.earning_recorded = true
     or new.vendor_id is null
  then
    return new;
  end if;

  if exists (select 1 from public.vendor_earnings where order_id = new.id) then
    update public.marketplace_orders set earning_recorded = true where id = new.id;
    return new;
  end if;

  select commission_rate into v_commission_rate
  from public.marketplace_vendors where id = new.vendor_id;
  if v_commission_rate is null then v_commission_rate := 0.15; end if;

  v_iva      := coalesce(new.tax_amount, 0);
  v_shipping := coalesce(new.shipping_cost, 0);
  v_gross := round((new.total_amount - v_iva - v_shipping)::numeric, 2);
  if v_gross <= 0 then
    v_gross := new.total_amount;
    v_iva := 0;
    v_shipping := 0;
  end if;

  v_platform_fee := round((v_gross * v_commission_rate)::numeric, 2);
  v_net := round((v_gross - v_platform_fee)::numeric, 2);

  -- Admin-editable Stripe fee (payout_settings.default), fallback 3.6% + $3.
  select coalesce(stripe_fee_pct, 3.6), coalesce(stripe_fee_fixed, 3)
    into v_fee_pct, v_fee_fixed
  from public.payout_settings where id = 'default';
  v_fee_pct   := coalesce(v_fee_pct, 3.6);
  v_fee_fixed := coalesce(v_fee_fixed, 3);

  v_stripe_fee := case
    when (new.stripe_session_id is not null or new.stripe_payment_intent_id is not null)
      then round((new.total_amount * v_fee_pct / 100.0 + v_fee_fixed)::numeric, 2)
    else 0
  end;
  v_cash_net := round((new.total_amount - v_stripe_fee)::numeric, 2);

  insert into public.vendor_earnings (
    vendor_id, order_id, gross_amount, commission_rate,
    platform_fee, stripe_fee, net_amount, currency, status, available_at
  ) values (
    new.vendor_id, new.id, v_gross, v_commission_rate,
    v_platform_fee, v_stripe_fee, v_net, coalesce(new.currency,'MXN'),
    'pending', now() + interval '14 days'
  );

  v_group := gen_random_uuid();
  insert into public.accounting_ledger (transaction_group, entry_type, account, amount, currency, order_id, vendor_id, description)
  values
    (v_group, 'debit',  'cash_stripe',              v_cash_net,     coalesce(new.currency,'MXN'), new.id, new.vendor_id, 'Efectivo neto recibido (Stripe)'),
    (v_group, 'debit',  'expense_stripe_fee',       v_stripe_fee,   coalesce(new.currency,'MXN'), new.id, new.vendor_id, 'Comisión Stripe estimada'),
    (v_group, 'credit', 'revenue_platform',         v_platform_fee, coalesce(new.currency,'MXN'), new.id, new.vendor_id, 'Comisión plataforma'),
    (v_group, 'credit', 'liability_vendor_payable', v_net,          coalesce(new.currency,'MXN'), new.id, new.vendor_id, 'Adeudo neto a vendor'),
    (v_group, 'credit', 'tax_iva_payable',          v_iva,          coalesce(new.currency,'MXN'), new.id, new.vendor_id, 'IVA recaudado'),
    (v_group, 'credit', 'shipping_collected',       v_shipping,     coalesce(new.currency,'MXN'), new.id, new.vendor_id, 'Envío cobrado al cliente');

  update public.marketplace_orders
    set platform_fee = v_platform_fee,
        vendor_net = v_net,
        stripe_fee = v_stripe_fee,
        earning_recorded = true
    where id = new.id;

  if new.product_id is not null then
    update public.marketplace_products
      set total_sold = total_sold + coalesce(new.quantity, 1),
          updated_at = now()
      where id = new.product_id and track_stock = true;
  end if;

  return new;
end;
$function$;
