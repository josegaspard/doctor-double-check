-- =========================================================================
-- FOLLOWUP 2026-06-10 — corrige regresiones que los triggers anti-auto-aprobación
-- (migración 20260610_p1_fixes.sql) introdujeron en flujos LEGÍTIMOS.
--
-- Mecanismo: un "bypass" de transacción que SÓLO pueden activar las funciones
-- SECURITY DEFINER controladas vía set_config(...,true). Un PATCH del cliente por
-- PostgREST NO puede ejecutar set_config, así que no puede falsear el bypass.
-- =========================================================================

-- 1) is_privileged_writer acepta además el bypass de transacción.
create or replace function public.is_privileged_writer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is null
      or coalesce(current_setting('app.bypass_protect', true), '') = 'on'
      or exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

-- 2) doctor_profiles: el DUEÑO puede REENVIAR credenciales (cedula/cofepris -> 'pending'),
--    nunca auto-aprobarse. status y columnas de dinero siguen inmutables para no-privilegiados.
create or replace function public.protect_doctor_profile_cols()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_privileged_writer() then return new; end if;
  new.status := old.status;
  -- Reenvío permitido: el dueño puede volver a 'pending', JAMÁS a 'approved'.
  if new.cedula_status is distinct from old.cedula_status and new.cedula_status <> 'pending' then
    new.cedula_status := old.cedula_status;
  end if;
  if new.cofepris_status is distinct from old.cofepris_status and new.cofepris_status <> 'pending' then
    new.cofepris_status := old.cofepris_status;
  end if;
  new.payouts_enabled   := old.payouts_enabled;
  new.pending_earnings  := old.pending_earnings;
  new.total_earnings    := old.total_earnings;
  new.stripe_account_id := old.stripe_account_id;
  return new;
end; $$;

-- 3) claim_cedula_atomic: la auto-aprobación por cédula verificada es legítima
--    (validada contra el registro SEP por verify-cedula-sep). Se ejecuta con el
--    JWT del doctor, así que activamos el bypass SÓLO para ese UPDATE de aprobación.
create or replace function public.claim_cedula_atomic(p_verification_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid; v_v record; v_updated int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return jsonb_build_object('success', false, 'error', 'No authenticated user'); end if;

  select id, user_id, cedula_number, is_verified, is_claimed into v_v
  from cedula_verifications where id = p_verification_id and user_id = v_user_id for update;

  if not found then return jsonb_build_object('success', false, 'error', 'Verification not found'); end if;
  if not v_v.is_verified then return jsonb_build_object('success', false, 'error', 'Cedula no verificada'); end if;
  if v_v.is_claimed then return jsonb_build_object('success', false, 'error', 'Ya reclamada'); end if;

  begin
    update cedula_verifications set is_claimed = true, claimed_by = v_user_id, claimed_at = now()
      where id = p_verification_id and is_claimed = false;
    get diagnostics v_updated = row_count;
  exception when unique_violation then
    return jsonb_build_object('success', false, 'error', 'Cedula ya reclamada por otro usuario');
  end;

  if v_updated = 0 then return jsonb_build_object('success', false, 'error', 'Race detectada, intenta de nuevo'); end if;

  -- Aprobación legítima: saltar el trigger anti-auto-aprobación SÓLO aquí.
  perform set_config('app.bypass_protect', 'on', true);
  update doctor_profiles
     set cedula_verification_id = p_verification_id,
         cedula_profesional = v_v.cedula_number,
         status = 'approved'
   where user_id = v_user_id;
  perform set_config('app.bypass_protect', 'off', true);

  return jsonb_build_object('success', true, 'auto_approved', true);
end; $$;

-- 4) Compra de almacenamiento por WALLET — RPC dedicada, atómica y con precio
--    SERVER-SIDE (igual que create-storage-checkout para Stripe). Antes el cliente
--    debitaba con process_wallet_purchase y luego escribía storage_limit_bytes a
--    mano (ahora bloqueado por el trigger). Aquí el cobro y el upgrade ocurren
--    juntos, el precio se valida contra site_settings (no se confía en el cliente),
--    y el storage se aplica con el bypass.
create or replace function public.purchase_storage_with_wallet(p_extra_gb integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_pricing jsonb; v_ppg numeric; v_price numeric; v_final numeric; v_bal numeric;
begin
  if v_user is null then return jsonb_build_object('success', false, 'error', 'No authenticated user'); end if;
  if p_extra_gb is null or p_extra_gb <= 0 then return jsonb_build_object('success', false, 'error', 'Invalid plan'); end if;

  -- Precio server-side desde site_settings.storage_pricing (misma fuente que la UI / Stripe).
  select value into v_pricing from public.site_settings where id = 'storage_pricing';
  v_ppg := coalesce((v_pricing->>'price_per_gb')::numeric, 49);
  select coalesce((p->>'price')::numeric, p_extra_gb * v_ppg) into v_price
    from jsonb_array_elements(coalesce(v_pricing->'plans', '[]'::jsonb)) p
    where (p->>'gb')::int = p_extra_gb limit 1;
  if v_price is null then v_price := p_extra_gb * v_ppg; end if;
  v_final := public.get_price_for_user(v_price, v_user);  -- descuento residente

  -- Débito atómico del wallet.
  select balance into v_bal from public.wallets where user_id = v_user for update;
  if not found then return jsonb_build_object('success', false, 'error', 'Wallet not found'); end if;
  if v_bal < v_final then return jsonb_build_object('success', false, 'error', 'Insufficient balance'); end if;

  insert into public.wallet_transactions (user_id, type, amount, description, status, metadata)
    values (v_user, 'purchase', -v_final, 'Expansión de almacenamiento: +' || p_extra_gb || 'GB', 'paid',
            jsonb_build_object('type', 'storage_upgrade', 'extra_gb', p_extra_gb));
  update public.wallets set balance = balance - v_final, updated_at = now() where user_id = v_user;

  -- Aplicar el almacenamiento comprado (server-side, con bypass del trigger).
  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles
    set storage_limit_bytes = coalesce(storage_limit_bytes, 0) + p_extra_gb::bigint * 1073741824
    where id = v_user;
  perform set_config('app.bypass_protect', 'off', true);

  return jsonb_build_object('success', true, 'amount_charged', v_final, 'new_balance', v_bal - v_final, 'extra_gb', p_extra_gb);
end; $$;
grant execute on function public.purchase_storage_with_wallet(integer) to authenticated;
