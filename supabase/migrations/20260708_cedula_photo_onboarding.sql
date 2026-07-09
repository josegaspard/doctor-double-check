-- Foto de la cédula profesional en el registro/onboarding del doctor (cliente 2026-07-08)
-- ────────────────────────────────────────────────────────────────────────────
-- El doctor sube una FOTO de su cédula profesional durante el onboarding para
-- que el admin pueda checar su identidad. El archivo vive en el bucket privado
-- 'doctor-credentials' (carpeta = uid del doctor; políticas ya existentes de
-- la migración 20260216031126); aquí solo guardamos el PATH dentro del bucket.

ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS cedula_photo_url text;

-- Progreso del onboarding: que la foto sobreviva si el doctor recarga a medio registro.
ALTER TABLE public.onboarding_progress
  ADD COLUMN IF NOT EXISTS cedula_photo_url text;
