-- =========================================================================
-- 2026-06-10 — Endurecimiento del OTP de expediente (vault).
--
-- CONTEXTO (verificado contra el esquema/RLS en vivo):
--   * Los BYTES del expediente ya están cerrados a doctores: las políticas de
--     storage de los buckets 'vault-files' y 'medical-history' sólo permiten al
--     DUEÑO (paciente). No existe política de doctor ni función service-role que
--     firme URLs para ellos → un doctor no puede descargar el contenido.
--   * La lectura de la TABLA vault_files por el doctor está gated por
--     user_has_vault_access() = existe un grant en vault_access creado por el
--     PROPIO paciente (consentimiento explícito, RLS-enforced).
--   * El OTP (expediente_otp + verify_expediente_otp) es un segundo factor de
--     consentimiento que en la práctica gobierna la UI del doctor.
--
-- Encadenar el OTP a la RLS de vault_files NO se hace aquí a propósito: (1)
-- rompería la UX (la lista de pacientes del doctor sale de esa misma tabla →
-- quedaría vacía y no podría ni solicitar el OTP), y (2) protegería algo que ya
-- está cerrado a nivel storage. El endurecimiento correcto es sobre el propio
-- mecanismo OTP, que tenía dos huecos reales:
--   1. verify_expediente_otp NO limitaba intentos → fuerza bruta del código de
--      6 dígitos posible dentro de la ventana de 2 min vía RPC directa.
--   2. Cada solicitud creaba un código nuevo SIN invalidar los anteriores →
--      varios códigos válidos simultáneos (mayor superficie).
--
-- Ambos se corrigen abajo de forma aditiva (sin cambiar la ruta de lectura).
-- =========================================================================

begin;

-- 1) Contador de intentos por código.
alter table public.expediente_otp
  add column if not exists attempts integer not null default 0;

-- 2) Código único activo: al insertar un OTP nuevo para (doctor, paciente),
--    invalida los anteriores que sigan sin usar. SECURITY DEFINER para no
--    depender de las RLS del rol que inserta (service-role o el propio doctor).
create or replace function public.expediente_otp_single_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.expediente_otp
     set used_at = now()
   where doctor_id = new.doctor_id
     and patient_id = new.patient_id
     and id <> new.id
     and used_at is null;
  return new;
end;
$$;

drop trigger if exists trg_expediente_otp_single_active on public.expediente_otp;
create trigger trg_expediente_otp_single_active
  after insert on public.expediente_otp
  for each row execute function public.expediente_otp_single_active();

-- 3) verify_expediente_otp con bloqueo por intentos fallidos.
--    Sólo evalúa el código ACTIVO más reciente para el par (doctor, paciente);
--    tras MAX intentos fallidos lo quema (used_at) y obliga a re-solicitar uno
--    nuevo (que dispara una notificación visible al paciente). 5 intentos sobre
--    900k combinaciones = probabilidad de adivinar despreciable.
create or replace function public.verify_expediente_otp(p_patient_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_doctor uuid := auth.uid();
  v_row    public.expediente_otp%rowtype;
  c_max    constant integer := 5;
begin
  if v_doctor is null then
    return false;
  end if;

  -- Código activo (sin usar, no expirado) más reciente para este par.
  select * into v_row
  from public.expediente_otp
  where patient_id = p_patient_id
    and doctor_id  = v_doctor
    and used_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found then
    return false;  -- expirado o nunca solicitado
  end if;

  -- Bloqueo: demasiados intentos → quemar el código y forzar re-solicitud.
  if coalesce(v_row.attempts, 0) >= c_max then
    update public.expediente_otp set used_at = now() where id = v_row.id;
    return false;
  end if;

  if v_row.otp_code = p_code then
    -- Éxito: consumir éste e invalidar cualquier otro código pendiente del par.
    update public.expediente_otp set used_at = now()
     where patient_id = p_patient_id and doctor_id = v_doctor and used_at is null;
    return true;
  end if;

  -- Fallo: contar el intento sobre el código activo.
  update public.expediente_otp set attempts = coalesce(attempts, 0) + 1
   where id = v_row.id;
  return false;
end;
$$;

commit;
