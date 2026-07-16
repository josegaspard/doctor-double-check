-- Receta: fecha de nacimiento del paciente (se muestra debajo de Edad).
-- Los medicamentos comercial+genérico NO requieren migración: viven dentro del
-- jsonb `medications` (campo nuevo `genericName` por elemento). Idempotente.
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS patient_birth_date text;
