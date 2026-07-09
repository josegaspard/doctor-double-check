-- La app ofrece 8 idiomas (es,en,pt,fr,it,de,ca,zh) pero el enum de la BD nunca
-- añadió 'ca' (catalán) ni 'zh' (chino) → al guardar preferred_language en esos
-- idiomas Postgres rechazaba el enum y la preferencia no se persistía (y dejaba una
-- promesa rechazada sin manejar en el front). Añadimos los valores faltantes.
-- ADD VALUE es idempotente con IF NOT EXISTS (PG12+); no puede ir dentro de un
-- bloque transaccional con uso posterior del valor, por eso van sueltos.
ALTER TYPE public.supported_language ADD VALUE IF NOT EXISTS 'ca';
ALTER TYPE public.supported_language ADD VALUE IF NOT EXISTS 'zh';
-- Descubierto al aplicar en prod (2026-07-09): 'it' y 'de' TAMPOCO estaban en el
-- enum (la migración 20260518 corrió parcial). Se añaden aquí también.
ALTER TYPE public.supported_language ADD VALUE IF NOT EXISTS 'it';
ALTER TYPE public.supported_language ADD VALUE IF NOT EXISTS 'de';
