-- Pivot table for explicit hospital ↔ doctor relationships
CREATE TABLE IF NOT EXISTS public.hospital_doctors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    doctor_id uuid NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
    position text,
    is_primary boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (hospital_id, doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_hospital_doctors_hospital ON public.hospital_doctors(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_doctors_doctor ON public.hospital_doctors(doctor_id);

ALTER TABLE public.hospital_doctors ENABLE ROW LEVEL SECURITY;

-- Public read (same posture as hospitals)
DROP POLICY IF EXISTS hospital_doctors_public_read ON public.hospital_doctors;
CREATE POLICY hospital_doctors_public_read ON public.hospital_doctors
    FOR SELECT
    USING (true);

-- Admin write (matches admin posture used in AdminHospitals)
DROP POLICY IF EXISTS hospital_doctors_admin_write ON public.hospital_doctors;
CREATE POLICY hospital_doctors_admin_write ON public.hospital_doctors
    FOR ALL
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
