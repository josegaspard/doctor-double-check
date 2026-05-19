-- Patient clinical history per subject (self or child). Allows duplicating
-- a parent's history into a minor's sub-profile without overwriting the parent record.
ALTER TABLE public.patient_clinical_history
  ADD COLUMN IF NOT EXISTS child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.patient_clinical_history
  DROP CONSTRAINT IF EXISTS patient_clinical_history_patient_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS patient_clinical_history_subject_uidx
  ON public.patient_clinical_history (patient_id, COALESCE(child_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Extend supported_language enum so the new locales (PT/FR/IT/DE) can be
-- persisted in profiles.preferred_language.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pt' AND enumtypid = 'public.supported_language'::regtype) THEN
    ALTER TYPE public.supported_language ADD VALUE 'pt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'fr' AND enumtypid = 'public.supported_language'::regtype) THEN
    ALTER TYPE public.supported_language ADD VALUE 'fr';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'it' AND enumtypid = 'public.supported_language'::regtype) THEN
    ALTER TYPE public.supported_language ADD VALUE 'it';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'de' AND enumtypid = 'public.supported_language'::regtype) THEN
    ALTER TYPE public.supported_language ADD VALUE 'de';
  END IF;
END$$;

-- Public/private toggle for clinical sessions (meetings/Zooms)
-- and translator opt-in flag for both lives and clinical sessions.
-- Requested by client 2026-05-18: "zooms abiertos al público" and "zooms cerrados con invitación".
-- Default false => existing rows behave as private invite-only, preserving prior RLS semantics.

ALTER TABLE public.clinical_sessions
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS translate_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS translate_target_lang TEXT;

ALTER TABLE public.lives
  ADD COLUMN IF NOT EXISTS translate_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS translate_target_lang TEXT;

CREATE INDEX IF NOT EXISTS idx_clinical_sessions_is_public
  ON public.clinical_sessions(is_public) WHERE is_public = true;

-- Open RLS read access on public sessions (everyone authenticated can see them).
DROP POLICY IF EXISTS "Anyone can view public clinical sessions" ON public.clinical_sessions;
CREATE POLICY "Anyone can view public clinical sessions"
  ON public.clinical_sessions FOR SELECT
  USING (is_public = true);
