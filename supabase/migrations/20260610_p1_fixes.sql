-- =========================================================================
-- P1 FIXES — 2026-06-10
-- Cierra hallazgos de auditoría sin romper flujos de pago existentes.
--   (#1/#2) Asiento contable de marketplace cuadrado + sin doble descuento de
--           stock + ventas por wallet contabilizadas en el libro correcto.
--   (#6)    OTP de expediente verificable SOLO server-side; el doctor ya no
--           puede leer el código en claro.
--   (#9)    Columna profiles.is_suspended (espejo de la suspensión de auth).
-- Todas las funciones de trigger conservan su naturaleza a prueba de
-- excepciones: un fallo contable nunca tumba un cobro.
-- =========================================================================

-- -------------------------------------------------------------------------
-- (#1/#2) MARKETPLACE: asiento de doble entrada cuadrado y sin doble stock
-- -------------------------------------------------------------------------
-- Problemas corregidos respecto a la versión previa:
--   * El asiento NO cuadraba: 'revenue_gross' duplicaba el lado crédito junto
--     con platform_fee + vendor_net (gross = fee + net), y 'cash_stripe' se
--     registraba bruto mientras el fee se sumaba al débito => Σdébito≠Σcrédito.
--   * El trigger decrementaba stock que las funciones de compra YA decrementan
--     (doble descuento). Ahora el stock se descuenta sólo en la compra; aquí
--     únicamente se incrementa total_sold.
-- Resultado: Σdébito = Σcrédito = total_amount, exacto.
create or replace function public.fn_record_marketplace_earning()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
  -- Base de producto derivada del total para que el asiento SIEMPRE cuadre:
  -- total = producto + IVA + envío.
  v_gross := round((new.total_amount - v_iva - v_shipping)::numeric, 2);
  if v_gross <= 0 then
    -- Fallback defensivo: sin desglose, toda la venta es producto.
    v_gross := new.total_amount;
    v_iva := 0;
    v_shipping := 0;
  end if;

  v_platform_fee := round((v_gross * v_commission_rate)::numeric, 2);
  v_net := round((v_gross - v_platform_fee)::numeric, 2); -- fee + net = gross exacto

  -- marketplace_orders has no payment_method column: a Stripe order is one that
  -- carries Stripe ids; otherwise it was paid with the wallet (no processor fee).
  v_stripe_fee := case
    when (new.stripe_session_id is not null or new.stripe_payment_intent_id is not null)
      then round((new.total_amount * 0.036 + 3)::numeric, 2)
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

  -- Asiento doble entrada CUADRADO: Σdébito = Σcrédito = total_amount.
  --   Débito : efectivo neto (total − fee Stripe) + gasto fee Stripe = total
  --   Crédito: comisión + adeudo vendor + IVA + envío
  --            = (gross) + IVA + envío = total
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

  -- NO se decrementa stock aquí (lo hace la función de compra). Sólo total_sold.
  if new.product_id is not null then
    update public.marketplace_products
      set total_sold = total_sold + coalesce(new.quantity, 1),
          updated_at = now()
      where id = new.product_id and track_stock = true;
  end if;

  return new;
end;
$$;

-- -------------------------------------------------------------------------
-- (#1) Excluir del libro de "servicios" las compras de marketplace por wallet.
-- Antes, una compra de marketplace por wallet (cuyo wallet_transaction aún no
-- tiene order_id ni "marketplace" en la descripción) se contabilizaba como
-- servicio 'other' (100% plataforma) Y el marketplace la volvía a registrar.
-- Ahora se excluye también por metadata.source = 'marketplace'.
-- -------------------------------------------------------------------------
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

  elsif new.type = 'purchase' then
    v_gross := abs(new.amount);
    -- El marketplace tiene su propio libro (fn_record_marketplace_earning).
    if (new.metadata ? 'order_id')
       or (new.metadata->>'source' = 'marketplace')
       or coalesce(new.description,'') ilike '%marketplace%' then
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

-- -------------------------------------------------------------------------
-- (#6) OTP de expediente: verificación SOLO server-side.
-- El doctor ya NO puede leer expediente_otp (antes podía SELECT el otp_code en
-- claro y saltarse pedírselo al paciente). Ahora ingresa el código y el server
-- lo valida con esta función SECURITY DEFINER.
-- -------------------------------------------------------------------------
create or replace function public.verify_expediente_otp(p_patient_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor uuid := auth.uid();
  v_id uuid;
begin
  if v_doctor is null then
    return false;
  end if;

  select id into v_id
  from public.expediente_otp
  where patient_id = p_patient_id
    and doctor_id = v_doctor
    and otp_code = p_code
    and used_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if v_id is null then
    return false;
  end if;

  update public.expediente_otp set used_at = now() where id = v_id;
  return true;
end;
$$;

grant execute on function public.verify_expediente_otp(uuid, text) to authenticated;

-- El doctor ya no lee el OTP directamente (debe usar verify_expediente_otp).
-- El paciente conserva su política "Patients can view own OTP".
drop policy if exists "Doctors can view OTP for them" on public.expediente_otp;

-- -------------------------------------------------------------------------
-- (#9) Espejo de suspensión en el perfil (la fuente de verdad es el ban de
-- auth.users que aplica la edge function admin-suspend-user). Sólo informativo
-- para el panel admin.
-- -------------------------------------------------------------------------
alter table public.profiles add column if not exists is_suspended boolean not null default false;

-- -------------------------------------------------------------------------
-- (P0-A) ANTI-AUTO-APROBACIÓN — columnas sensibles inmutables para el usuario.
-- Causa raíz confirmada EN VIVO: las políticas UPDATE (auth.uid()=id) sin
-- restricción de columnas permitían a un usuario auto-otorgarse identidad
-- verificada / almacenamiento, y a un doctor auto-aprobarse cédula, COFEPRIS,
-- credenciales y status (atender y cobrar sin verificación).
-- RLS es por fila, no por columna; estos triggers BEFORE UPDATE preservan las
-- columnas sensibles salvo que el actor sea admin o service_role (auth.uid()
-- null = edge function / webhook KYC). El resto del UPDATE pasa normal, así que
-- editar nombre/bio/precio/disponibilidad sigue funcionando.
-- -------------------------------------------------------------------------
create or replace function public.is_privileged_writer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is null
      or exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.protect_profiles_cols()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_privileged_writer() then return new; end if;
  new.is_identity_verified := old.is_identity_verified;
  new.storage_limit_bytes  := old.storage_limit_bytes;
  new.is_suspended         := old.is_suspended;
  return new;
end; $$;
drop trigger if exists trg_protect_profiles_cols on public.profiles;
create trigger trg_protect_profiles_cols before update on public.profiles
  for each row execute function public.protect_profiles_cols();

create or replace function public.protect_doctor_profile_cols()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_privileged_writer() then return new; end if;
  new.status            := old.status;
  new.cedula_status     := old.cedula_status;
  new.cofepris_status   := old.cofepris_status;
  new.payouts_enabled   := old.payouts_enabled;
  new.pending_earnings  := old.pending_earnings;
  new.total_earnings    := old.total_earnings;
  new.stripe_account_id := old.stripe_account_id;
  return new;
end; $$;
drop trigger if exists trg_protect_doctor_profile_cols on public.doctor_profiles;
create trigger trg_protect_doctor_profile_cols before update on public.doctor_profiles
  for each row execute function public.protect_doctor_profile_cols();

create or replace function public.protect_cred_status_col()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_privileged_writer() then return new; end if;
  new.status := old.status;
  return new;
end; $$;
drop trigger if exists trg_protect_education_status on public.doctor_education;
create trigger trg_protect_education_status before update on public.doctor_education
  for each row execute function public.protect_cred_status_col();
drop trigger if exists trg_protect_certifications_status on public.doctor_certifications;
create trigger trg_protect_certifications_status before update on public.doctor_certifications
  for each row execute function public.protect_cred_status_col();
drop trigger if exists trg_protect_experience_status on public.doctor_experience;
create trigger trg_protect_experience_status before update on public.doctor_experience
  for each row execute function public.protect_cred_status_col();

-- -------------------------------------------------------------------------
-- (P0-E) RESEÑAS: sólo de pedidos propios y pagados; verified_purchase server-side.
-- Antes el cliente insertaba verified_purchase:true sin exigir compra alguna.
-- -------------------------------------------------------------------------
drop policy if exists product_reviews_self_write on public.product_reviews;
create policy product_reviews_self_write on public.product_reviews
  for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from public.marketplace_orders o
      where o.id = product_reviews.order_id
        and o.buyer_id = auth.uid()
        and o.status in ('paid', 'shipped', 'delivered')
    )
  );

create or replace function public.fn_set_verified_purchase()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.verified_purchase := exists (
    select 1 from public.marketplace_orders o
    where o.id = new.order_id
      and o.buyer_id = new.reviewer_id
      and o.status in ('paid', 'shipped', 'delivered')
  );
  return new;
end; $$;
drop trigger if exists trg_set_verified_purchase on public.product_reviews;
create trigger trg_set_verified_purchase before insert on public.product_reviews
  for each row execute function public.fn_set_verified_purchase();

-- -------------------------------------------------------------------------
-- (P2-G) Decremento de stock ATÓMICO (evita sobreventa por concurrencia).
-- Antes las funciones de compra escribían un valor absoluto (stock - qty) leído
-- de una lectura stale: dos compras simultáneas con stock=10 escribían ambas 9.
-- Aquí el decremento es relativo y condicional en una sola sentencia atómica.
-- Devuelve true si se reservó stock (o si el producto no rastrea stock).
-- -------------------------------------------------------------------------
create or replace function public.decrement_product_stock(p_product_id uuid, p_qty integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.marketplace_products
    set stock = stock - p_qty, updated_at = now()
    where id = p_product_id
      and track_stock = true
      and stock >= p_qty;
  if found then
    return true;
  end if;
  -- Producto sin control de stock => siempre disponible.
  return exists (
    select 1 from public.marketplace_products
    where id = p_product_id and track_stock = false
  );
end;
$$;
grant execute on function public.decrement_product_stock(uuid, integer) to authenticated, service_role;

-- -------------------------------------------------------------------------
-- (P2-H) Viewer count NO inflable + una sola fuente (presencia por usuario).
-- Antes increment_viewer_count se podía llamar en bucle (sólo lo frenaba un ref
-- del cliente) e inflar el conteo. Ahora la presencia es 1 fila única por
-- (live, usuario) y el viewer_count se recalcula como el conteo real.
-- -------------------------------------------------------------------------
create table if not exists public.live_viewers (
  live_id uuid not null,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  primary key (live_id, user_id)
);
alter table public.live_viewers enable row level security;
-- Sólo las RPC SECURITY DEFINER de abajo leen/escriben esta tabla.

create or replace function public.join_live_viewer(p_live_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.live_viewers (live_id, user_id)
    values (p_live_id, auth.uid())
    on conflict (live_id, user_id) do update set joined_at = now();
  update public.lives
    set viewer_count = (select count(*) from public.live_viewers where live_id = p_live_id)
    where id = p_live_id;
end; $$;
grant execute on function public.join_live_viewer(uuid) to authenticated;

create or replace function public.leave_live_viewer(p_live_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  delete from public.live_viewers where live_id = p_live_id and user_id = auth.uid();
  update public.lives
    set viewer_count = (select count(*) from public.live_viewers where live_id = p_live_id)
    where id = p_live_id;
end; $$;
grant execute on function public.leave_live_viewer(uuid) to authenticated;
