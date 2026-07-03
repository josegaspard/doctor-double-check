-- Seguridad de insignias + verificación de identidad atómica (2026-07-03).
-- 1) BLOQUEADOR: un doctor podía auto-asignarse manual_badge/badge_override porque
--    protect_doctor_profile_cols no los protegía. Se añaden a las columnas que solo
--    un escritor privilegiado (admin/service_role) puede cambiar.
-- 2) current_user_badge() ahora solo cuenta el badge si el doctor está APROBADO
--    (un pending/rejected con badge ya no entra al chat exclusivo ni a gold-only).
-- 3) RPC admin_review_identity_verification: hace TODO el acto de verificación en una
--    sola transacción (identidad + is_identity_verified + badge), con chequeo de admin
--    y errores propagados. Evita el estado parcial que dejaba "verificado a medias" y
--    hacía reaparecer la ventana de verificación.

-- 1) Proteger manual_badge y badge_override de escrituras no privilegiadas.
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
  new.manual_badge      := old.manual_badge;    -- insignia de confianza: solo admin
  new.badge_override    := old.badge_override;  -- override de rango: solo admin
  return new;
end; $$;
-- El trigger trg_protect_doctor_profile_cols (before update) ya existe; no se recrea.

-- 2) El badge solo vale si el doctor está aprobado.
create or replace function public.current_user_badge()
returns text language sql stable security definer set search_path = public as $$
  select manual_badge from public.doctor_profiles
   where user_id = auth.uid() and status = 'approved' limit 1;
$$;
grant execute on function public.current_user_badge() to authenticated;

-- 3) Verificación de identidad atómica (aprobar/rechazar + badge en un commit).
create or replace function public.admin_review_identity_verification(
  p_id uuid,
  p_approve boolean,
  p_badge text default 'none',
  p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_meta jsonb;
  v_has_doctor boolean;
begin
  -- Solo super-admin.
  if not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin') then
    raise exception 'not authorized';
  end if;

  select user_id, metadata into v_user, v_meta
    from public.identity_verifications where id = p_id;
  if v_user is null then
    raise exception 'verification not found';
  end if;

  if p_approve then
    update public.identity_verifications
       set status = 'verified', verified_at = now(), updated_at = now()
     where id = p_id;
    update public.profiles set is_identity_verified = true where id = v_user;
  else
    update public.identity_verifications
       set status = 'failed', updated_at = now(),
           metadata = coalesce(v_meta, '{}'::jsonb) || jsonb_build_object('rejection_reason', p_reason)
     where id = p_id;
  end if;

  -- El badge solo aplica a doctores. Se asigna SOLO aquí (acto de verificación del admin).
  select exists(select 1 from public.doctor_profiles where user_id = v_user) into v_has_doctor;
  if v_has_doctor then
    if p_approve then
      update public.doctor_profiles
         set manual_badge = case when p_badge in ('gold','verified') then p_badge else null end
       where user_id = v_user;
    else
      -- Identidad rechazada → se retira cualquier insignia de confianza.
      update public.doctor_profiles set manual_badge = null where user_id = v_user;
    end if;
  end if;
end; $$;

grant execute on function public.admin_review_identity_verification(uuid, boolean, text, text) to authenticated;
