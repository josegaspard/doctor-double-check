-- =========================================================================
-- 2026-07-16 · Anti-suplantación de médico (P1)
-- =========================================================================
-- La cédula profesional Y el nombre son datos PÚBLICOS del registro SEP. La
-- auto-aprobación se basaba en que el nombre del perfil (editable por el usuario)
-- coincidiera con el de la SEP → un impostor podía cambiar su nombre al de un
-- médico real, "verificar" su cédula pública y quedar APROBADO como doctor
-- (recetar, cobrar, ver expedientes).
--
-- FIX: claim_cedula_atomic YA NO pone status='approved'. Registra la cédula y
-- deja al doctor en 'pending' → aprobación por revisión de admin (AdminVerifications,
-- que coteja la foto de cédula) o por KYC biométrico. Es un cambio OPERATIVO:
-- los médicos dejan de aprobarse solos. Revertir = restaurar status='approved'.
-- =========================================================================
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

  -- Registrar la cédula reclamada, PERO NO auto-aprobar: el nombre SEP es público
  -- y forjable. Queda 'pending' hasta revisión de admin / KYC.
  update doctor_profiles
     set cedula_verification_id = p_verification_id,
         cedula_profesional = v_v.cedula_number
   where user_id = v_user_id;

  return jsonb_build_object('success', true, 'auto_approved', false, 'needs_review', true);
end; $$;
