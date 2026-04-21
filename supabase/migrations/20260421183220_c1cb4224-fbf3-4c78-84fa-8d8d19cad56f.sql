
-- Clinical cases for Medical Master Education
CREATE TABLE public.clinical_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  specialty TEXT NOT NULL,
  category TEXT,
  patient_age INTEGER,
  patient_sex TEXT,
  file_url TEXT,
  thumbnail_url TEXT,
  comments_count INTEGER NOT NULL DEFAULT 0,
  views_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinical_cases_specialty ON public.clinical_cases(specialty);
CREATE INDEX idx_clinical_cases_author ON public.clinical_cases(author_id);
CREATE INDEX idx_clinical_cases_created ON public.clinical_cases(created_at DESC);

ALTER TABLE public.clinical_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors and residents can view cases"
ON public.clinical_cases FOR SELECT
USING (
  has_role(auth.uid(), 'doctor'::app_role)
  OR has_role(auth.uid(), 'resident'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Approved doctors can create cases"
ON public.clinical_cases FOR INSERT
WITH CHECK (
  auth.uid() = author_id
  AND is_approved_doctor(auth.uid())
);

CREATE POLICY "Authors can update own cases"
ON public.clinical_cases FOR UPDATE
USING (auth.uid() = author_id);

CREATE POLICY "Authors and admins can delete cases"
ON public.clinical_cases FOR DELETE
USING (auth.uid() = author_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_clinical_cases_updated_at
BEFORE UPDATE ON public.clinical_cases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comments
CREATE TABLE public.clinical_case_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.clinical_cases(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_comments_case ON public.clinical_case_comments(case_id, created_at);

ALTER TABLE public.clinical_case_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors and residents can view comments"
ON public.clinical_case_comments FOR SELECT
USING (
  has_role(auth.uid(), 'doctor'::app_role)
  OR has_role(auth.uid(), 'resident'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Doctors and residents can comment"
ON public.clinical_case_comments FOR INSERT
WITH CHECK (
  auth.uid() = author_id
  AND (
    has_role(auth.uid(), 'doctor'::app_role)
    OR has_role(auth.uid(), 'resident'::app_role)
  )
);

CREATE POLICY "Authors can update own comments"
ON public.clinical_case_comments FOR UPDATE
USING (auth.uid() = author_id);

CREATE POLICY "Authors and admins can delete comments"
ON public.clinical_case_comments FOR DELETE
USING (auth.uid() = author_id OR has_role(auth.uid(), 'admin'::app_role));

-- Trigger to keep comments_count in sync
CREATE OR REPLACE FUNCTION public.sync_clinical_case_comments_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.clinical_cases SET comments_count = comments_count + 1 WHERE id = NEW.case_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.clinical_cases SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.case_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_sync_clinical_case_comments_count
AFTER INSERT OR DELETE ON public.clinical_case_comments
FOR EACH ROW EXECUTE FUNCTION public.sync_clinical_case_comments_count();
