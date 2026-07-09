-- Membrete completo del médico en las recetas.
-- El cliente pidió que la receta generada muestre TODOS los datos del doctor
-- (universidad, afiliación hospitalaria, Céd. Prof., Céd. Esp./No. Consejo, COFEPRIS).
-- La RLS de doctor_profiles ("viewable by owner or admin only") impide que un
-- PACIENTE lea esos campos al descargar su receta. Igual que get_doctor_signature,
-- exponemos SÓLO las credenciales profesionales públicas (las que ya se imprimen en
-- la receta) vía una función SECURITY DEFINER. NO incluye signature_url ni datos
-- sensibles. Funciona para recetas nuevas y ya existentes sin snapshot en la tabla.
--
-- Se devuelven tanto los campos que el médico llena hoy en DoctorCredentialsCard
-- (cedula_especialidad, workplaces, secondary_specialties, university) como los
-- legacy de onboarding (numero_consejo, practice_hospital, cofepris_permit) para
-- que el frontend elija con fallback.
CREATE OR REPLACE FUNCTION public.get_doctor_prescription_credentials(p_doctor_user_id uuid)
RETURNS TABLE (
  specialty text,
  secondary_specialties jsonb,
  license text,
  cedula_profesional text,
  cedula_especialidad text,
  numero_consejo text,
  university text,
  workplaces jsonb,
  practice_hospital text,
  cofepris_permit text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dp.specialty,
    to_jsonb(dp.secondary_specialties),
    dp.license,
    dp.cedula_profesional,
    dp.cedula_especialidad,
    dp.numero_consejo,
    dp.university,
    to_jsonb(dp.workplaces),
    dp.practice_hospital,
    dp.cofepris_permit
  FROM public.doctor_profiles dp
  WHERE dp.user_id = p_doctor_user_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_doctor_prescription_credentials(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_doctor_prescription_credentials(uuid) TO authenticated;
