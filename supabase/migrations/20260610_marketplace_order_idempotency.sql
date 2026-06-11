-- 2026-06-10 — Idempotencia de órdenes de marketplace (anti doble-cobro).
alter table public.marketplace_orders
  add column if not exists idempotency_key text;
create unique index if not exists ux_marketplace_orders_idempotency
  on public.marketplace_orders (idempotency_key)
  where idempotency_key is not null;
