-- Patient-facing appointment booking on top of doctor_availability slots.

CREATE TABLE IF NOT EXISTS public.appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    doctor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    availability_id uuid REFERENCES public.doctor_availability(id) ON DELETE SET NULL,
    scheduled_at timestamptz NOT NULL,
    duration_minutes integer NOT NULL DEFAULT 30,
    reason text,
    status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'cancelled', 'completed')),
    cancellation_reason text,
    notes text,
    daily_room_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor  ON public.appointments(doctor_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_status  ON public.appointments(status);

-- Prevent double-booking the same availability slot
CREATE UNIQUE INDEX IF NOT EXISTS uniq_appointments_one_per_slot
  ON public.appointments(availability_id)
  WHERE availability_id IS NOT NULL AND status IN ('requested', 'confirmed');

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Patient sees own appointments, doctor sees their bookings, admin sees all.
DROP POLICY IF EXISTS appointments_read ON public.appointments;
CREATE POLICY appointments_read ON public.appointments
  FOR SELECT
  USING (
    patient_id = auth.uid()
    OR doctor_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Patient can create their own appointment.
DROP POLICY IF EXISTS appointments_patient_insert ON public.appointments;
CREATE POLICY appointments_patient_insert ON public.appointments
  FOR INSERT
  WITH CHECK (patient_id = auth.uid());

-- Patient can cancel their own; doctor can update status (confirm/complete/cancel) of theirs.
DROP POLICY IF EXISTS appointments_update ON public.appointments;
CREATE POLICY appointments_update ON public.appointments
  FOR UPDATE
  USING (
    patient_id = auth.uid()
    OR doctor_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    patient_id = auth.uid()
    OR doctor_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.touch_appointments_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.touch_appointments_updated_at();
