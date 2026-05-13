-- Content moderation queue for doctor-uploaded content.
-- All new uploads start as 'pending'; admins approve/reject via /admin/content-moderation.
-- Existing rows are auto-approved (grandfathered).

DO $$ BEGIN
  CREATE TYPE public.content_moderation_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.doctor_content
  ADD COLUMN IF NOT EXISTS moderation_status public.content_moderation_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS moderation_note text,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by uuid;

-- Grandfather all existing content as approved so the platform doesn't appear empty
UPDATE public.doctor_content
  SET moderation_status = 'approved', moderated_at = now()
  WHERE moderation_status = 'pending' AND created_at < now() - interval '5 minutes';

CREATE INDEX IF NOT EXISTS idx_doctor_content_moderation
  ON public.doctor_content(moderation_status, created_at DESC);

-- Public-facing queries should only see approved content. We tighten via a SECURITY DEFINER
-- view OR via RLS update — using RLS update keeps existing query patterns.
-- Existing policies on doctor_content already exist; we add a stricter SELECT for non-admin readers.
DROP POLICY IF EXISTS doctor_content_public_approved_only ON public.doctor_content;
CREATE POLICY doctor_content_public_approved_only ON public.doctor_content
  FOR SELECT
  TO public
  USING (
    moderation_status = 'approved'
    OR creator_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );
