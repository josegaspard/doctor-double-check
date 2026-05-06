
ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.live_status'::regtype AND enumlabel = 'scheduled') THEN
    ALTER TYPE public.live_status ADD VALUE 'scheduled';
  END IF;
END $$;
