
-- ================================================
-- F: Patient Clinical History Form (at registration)
-- ================================================
CREATE TABLE public.patient_clinical_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  blood_type TEXT,
  allergies TEXT,
  chronic_conditions TEXT,
  current_medications TEXT,
  previous_surgeries TEXT,
  family_history TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT patient_clinical_history_patient_id_key UNIQUE (patient_id)
);

ALTER TABLE public.patient_clinical_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can manage own clinical history"
ON public.patient_clinical_history FOR ALL
USING (auth.uid() = patient_id);

CREATE POLICY "Patients can view own clinical history"
ON public.patient_clinical_history FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Admins can view all clinical histories"
ON public.patient_clinical_history FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_patient_clinical_history_updated_at
BEFORE UPDATE ON public.patient_clinical_history
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================================================
-- G: Storage Limits (iCloud-style)
-- ================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT NOT NULL DEFAULT 1073741824; -- 1 GB default

-- ================================================
-- H: Medical News
-- ================================================
CREATE TABLE public.medical_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  image_url TEXT,
  source_url TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published news"
ON public.medical_news FOR SELECT
USING (is_published = true);

CREATE POLICY "Admins can manage all news"
ON public.medical_news FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_medical_news_updated_at
BEFORE UPDATE ON public.medical_news
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================================================
-- I: User Blocks
-- ================================================
CREATE TABLE public.user_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT user_blocks_unique UNIQUE (blocker_id, blocked_id),
  CONSTRAINT user_blocks_no_self CHECK (blocker_id != blocked_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own blocks"
ON public.user_blocks FOR ALL
USING (auth.uid() = blocker_id);

CREATE POLICY "Users can view if they are blocked"
ON public.user_blocks FOR SELECT
USING (auth.uid() = blocked_id);

-- ================================================
-- K: Document Signatures (onboarding)
-- ================================================
CREATE TABLE public.document_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL, -- 'terms_of_service', 'privacy_policy', 'doctor_contract'
  document_version TEXT NOT NULL DEFAULT '1.0',
  signer_name TEXT NOT NULL,
  ip_address TEXT,
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT document_signatures_unique UNIQUE (user_id, document_type, document_version)
);

ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own signatures"
ON public.document_signatures FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own signatures"
ON public.document_signatures FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all signatures"
ON public.document_signatures FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- ================================================
-- E: Fund Holds (retention de fondos)
-- ================================================
CREATE TABLE public.fund_holds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  consultation_id UUID,
  status TEXT NOT NULL DEFAULT 'held', -- held, released, disputed
  held_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  release_at TIMESTAMP WITH TIME ZONE, -- scheduled release
  released_at TIMESTAMP WITH TIME ZONE, -- actual release
  released_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.fund_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors can view own holds"
ON public.fund_holds FOR SELECT
USING (auth.uid() = doctor_id);

CREATE POLICY "Admins can manage all holds"
ON public.fund_holds FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- J: Add video_call fields to consultations
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS video_room_name TEXT;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS video_room_url TEXT;

-- Enable realtime for medical_news
ALTER PUBLICATION supabase_realtime ADD TABLE public.medical_news;
