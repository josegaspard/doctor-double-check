ALTER TABLE public.doctor_content ADD COLUMN IF NOT EXISTS is_masterclass boolean DEFAULT false;
ALTER TABLE public.doctor_content ADD COLUMN IF NOT EXISTS masterclass_sessions jsonb DEFAULT null;