-- =========================================================================
-- 2026-08-25 (B) — ✅ APLICADA con el OK de Jose (25-ago).
--
-- SÍNTOMA: en /doctor/vault el médico verifica el OTP, la app le dice
-- «Verificación exitosa. Acceso al expediente concedido» … y al abrir el
-- estudio sale «No se pudo cargar el documento» (401 al firmar la URL).
--
-- CAUSA: no es un fallo, es una decisión tomada el 2026-06-10 y escrita en
-- `20260610_otp_bruteforce_hardening.sql`: las policies de storage de
-- 'vault-files' y 'medical-history' sólo permiten al DUEÑO (el paciente). El
-- médico nunca puede descargar los bytes. Consecuencia: el circuito «Mis
-- Pacientes» + OTP enseña metadatos y promete un acceso que no existe.
--
-- ARREGLO PROPUESTO: el médico puede leer el objeto sólo si el paciente le
-- concedió acceso a ESE archivo (`vault_access`, que sólo el paciente puede
-- crear) y el permiso sigue vigente. Es el mismo consentimiento que ya abre la
-- fila de `vault_files`; aquí sólo se alinean los bytes con los metadatos.
--
-- Lo que este arreglo NO hace: el OTP seguirá viviendo sólo en el estado de
-- React, así que sigue siendo una barrera de interfaz, no de base de datos.
-- Encadenarlo de verdad exige guardar la verificación en la BD (más trabajo).
--
-- Revertir = el DROP POLICY del final.
-- =========================================================================

begin;

drop policy if exists "Doctors read vault files granted to them"
  on storage.objects;

create policy "Doctors read vault files granted to them"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'vault-files'
  and exists (
    select 1
    from public.vault_files vf
    join public.vault_access va on va.file_id = vf.id
    where vf.file_url = storage.objects.name
      and va.doctor_id = (select auth.uid())
      and (va.expires_at is null or va.expires_at > now())
  )
);

commit;

-- Revertir:
--   drop policy "Doctors read vault files granted to them" on storage.objects;
