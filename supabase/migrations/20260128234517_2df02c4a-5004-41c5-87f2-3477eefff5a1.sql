-- Add column to track reminder notifications
ALTER TABLE public.doctor_availability 
ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;

-- Create index for efficient queries on upcoming availabilities
CREATE INDEX IF NOT EXISTS idx_doctor_availability_upcoming 
ON public.doctor_availability (scheduled_at, status, reminder_sent) 
WHERE status IN ('scheduled', 'confirmed') AND reminder_sent = false;