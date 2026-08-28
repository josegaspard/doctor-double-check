-- =========================================================================
-- 2026-08-25 — «Mis Pacientes» mostraba «Paciente da2» y «Sin correo registrado».
--
-- SÍNTOMA (visto en la web real, no deducido): en /doctor/vault cada tarjeta
-- salía con el nombre de relleno `Paciente ${id.slice(-3)}` y con el contacto de
-- cobros vacío — aunque la propia pantalla promete «Aquí también verás el
-- contacto de cobros y los totales pagados por cada paciente».
--
-- CAUSA: `profiles` sólo tiene dos policies de SELECT — «Users can view own
-- profile» y «Admins can view all profiles». Un médico no puede leer NINGUNA
-- fila de otro usuario. Y `profiles_public` lleva `security_invoker = true`
-- desde el 2026-04-22, así que hereda ese candado y devuelve 0 filas.
-- DoctorVault.tsx pide el nombre a `profiles_public` y el correo a `profiles`:
-- ambas consultas volvían vacías y el front caía al texto de relleno.
--
-- ARREGLO: una policy ADITIVA de SELECT. El médico ve la ficha de un paciente
-- sólo si ese paciente le concedió acceso a su expediente. Ese grant vive en
-- `vault_access` y **sólo lo puede crear el paciente** (policy «Patients can
-- grant access to approved doctors»); el médico ahí únicamente tiene SELECT de
-- lo suyo. O sea: no hay forma de que un médico se autoconceda la identidad de
-- nadie. Es exactamente el mismo consentimiento que ya gobierna la lista.
--
-- No se toca ninguna policy existente. Revertir = el DROP POLICY del final.
-- =========================================================================

begin;

drop policy if exists "Doctors read identity of patients who granted them access"
  on public.profiles;

create policy "Doctors read identity of patients who granted them access"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.vault_access va
    join public.vault_files vf on vf.id = va.file_id
    where va.doctor_id = (select auth.uid())
      and vf.patient_id = profiles.id
      and (va.expires_at is null or va.expires_at > now())
  )
);

commit;

-- Revertir:
--   drop policy "Doctors read identity of patients who granted them access"
--     on public.profiles;
