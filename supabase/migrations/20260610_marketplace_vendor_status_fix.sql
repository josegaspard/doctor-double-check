-- =========================================================================
-- 2026-06-10 — P0: un vendor podía FABRICAR earnings pagados sin pago real.
--
-- HUECO (verificado en vivo): la política RLS "Vendors can update order status"
-- sólo valida vendor_id (sin proteger `status`), y el trigger
-- fn_record_marketplace_earning dispara al cambiar status a
-- paid/processing/shipped/delivered SIN verificar el pago. Un vendor tomaba su
-- propia orden `pending` (NO pagada) y la ponía en 'delivered' → se acreditaban
-- vendor_earnings + asientos contables → a los 14 días process-vendor-payouts le
-- transfería dinero REAL.
--
-- FLUJO LEGÍTIMO (verificado en código): el pago (pending→paid) lo hace SIEMPRE
-- el flujo de pago con SERVICE ROLE (create-marketplace-checkout/stripe-webhook y
-- purchase-marketplace-wallet usan adminClient → is_privileged_writer()=true).
-- El vendor SÓLO avanza fulfillment: paid→shipped ("Enviar") y shipped→delivered
-- ("Entregado") (VendorDashboard.tsx:405-406). Nunca pending→* ni *→paid.
--
-- FIX: trigger BEFORE UPDATE que, para escritores NO privilegiados, (a) permite
-- únicamente las dos transiciones de fulfillment legítimas y congela cualquier
-- otro cambio de `status`, y (b) congela TODAS las columnas financieras/de pago.
-- El flujo de pago (service role) y el admin no se ven afectados.
-- =========================================================================

begin;

create or replace function public.protect_marketplace_order_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged_writer() then
    return new;  -- flujo de pago (service role) / admin / RPC con bypass
  end if;

  -- Sólo se permite avanzar el fulfillment de una orden YA pagada.
  if new.status is distinct from old.status then
    if not ( (old.status = 'paid'    and new.status = 'shipped')
          or (old.status = 'shipped' and new.status = 'delivered') ) then
      new.status := old.status;  -- bloquea pending->*, *->paid, saltos, etc.
    end if;
  end if;

  -- Un vendor/comprador jamás reescribe dinero ni prueba de pago.
  new.total_amount             := old.total_amount;
  new.vendor_net               := old.vendor_net;
  new.platform_fee             := old.platform_fee;
  new.stripe_fee               := old.stripe_fee;
  new.earning_recorded         := old.earning_recorded;
  new.stripe_session_id        := old.stripe_session_id;
  new.stripe_payment_intent_id := old.stripe_payment_intent_id;
  new.refund_status            := old.refund_status;
  new.buyer_id                 := old.buyer_id;
  new.vendor_id                := old.vendor_id;
  return new;
end;
$$;

drop trigger if exists trg_protect_marketplace_order_cols on public.marketplace_orders;
create trigger trg_protect_marketplace_order_cols
  before update on public.marketplace_orders
  for each row execute function public.protect_marketplace_order_cols();

commit;
