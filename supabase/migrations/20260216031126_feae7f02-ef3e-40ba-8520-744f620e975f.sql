
-- Doctor Education History (universities, degrees)
CREATE TABLE public.doctor_education (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL,
  institution TEXT NOT NULL,
  degree TEXT NOT NULL,
  field_of_study TEXT,
  start_year INTEGER,
  end_year INTEGER,
  description TEXT,
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Doctor Certifications (board certs, specialties)
CREATE TABLE public.doctor_certifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL,
  name TEXT NOT NULL,
  issuing_organization TEXT NOT NULL,
  issue_date DATE,
  expiry_date DATE,
  credential_id TEXT,
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Doctor Professional Experience
CREATE TABLE public.doctor_experience (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL,
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  location TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.doctor_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_experience ENABLE ROW LEVEL SECURITY;

-- RLS for doctor_education
CREATE POLICY "Doctors can manage own education"
  ON public.doctor_education FOR ALL
  USING (auth.uid() = doctor_id);

CREATE POLICY "Approved education is public"
  ON public.doctor_education FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Admins can manage all education"
  ON public.doctor_education FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS for doctor_certifications
CREATE POLICY "Doctors can manage own certifications"
  ON public.doctor_certifications FOR ALL
  USING (auth.uid() = doctor_id);

CREATE POLICY "Approved certifications are public"
  ON public.doctor_certifications FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Admins can manage all certifications"
  ON public.doctor_certifications FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS for doctor_experience
CREATE POLICY "Doctors can manage own experience"
  ON public.doctor_experience FOR ALL
  USING (auth.uid() = doctor_id);

CREATE POLICY "Approved experience is public"
  ON public.doctor_experience FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Admins can manage all experience"
  ON public.doctor_experience FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for credential documents
INSERT INTO storage.buckets (id, name, public) VALUES ('doctor-credentials', 'doctor-credentials', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for doctor-credentials
CREATE POLICY "Doctors can upload own credentials"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'doctor-credentials' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Doctors can view own credentials"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'doctor-credentials' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all credentials"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'doctor-credentials' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Doctors can delete own credentials"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'doctor-credentials' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Also insert storage pricing setting
INSERT INTO public.site_settings (id, value) 
VALUES ('storage_pricing', '{"price_per_gb": 49, "plans": [{"gb": 1, "label": "+1 GB"}, {"gb": 5, "label": "+5 GB", "badge": "Popular"}, {"gb": 10, "label": "+10 GB", "badge": "Mejor valor"}]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Triggers for updated_at
CREATE TRIGGER update_doctor_education_updated_at
  BEFORE UPDATE ON public.doctor_education
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_doctor_certifications_updated_at
  BEFORE UPDATE ON public.doctor_certifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_doctor_experience_updated_at
  BEFORE UPDATE ON public.doctor_experience
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
