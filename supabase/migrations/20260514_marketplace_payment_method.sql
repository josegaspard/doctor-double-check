-- Add payment_method column to marketplace_orders so wallet purchases are
-- distinguishable from Stripe purchases without abusing other fields.
alter table public.marketplace_orders
  add column if not exists payment_method text not null default 'stripe';

-- For legacy rows, keep 'stripe' as the default (existing behavior). New
-- wallet purchases will explicitly set 'wallet'.
comment on column public.marketplace_orders.payment_method is
  'Payment method used: stripe (card) or wallet (in-app credits).';
