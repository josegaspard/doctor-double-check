
ALTER TABLE public.clinical_sessions
  ADD COLUMN IF NOT EXISTS daily_room_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS daily_room_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS meeting_notes text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS meeting_summary text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_participants integer DEFAULT 10;

-- Allow residents to create sessions too
ALTER TABLE public.clinical_session_invitations
  ADD COLUMN IF NOT EXISTS invitee_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invitee_email text DEFAULT NULL;
