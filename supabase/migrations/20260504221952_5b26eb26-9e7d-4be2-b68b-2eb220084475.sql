CREATE TABLE public.arco_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL CHECK (length(full_name) BETWEEN 2 AND 200),
  email TEXT NOT NULL CHECK (length(email) BETWEEN 5 AND 255),
  request_type TEXT NOT NULL CHECK (request_type IN ('access','rectification','cancellation','opposition')),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 10 AND 5000),
  identification_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_review','resolved','rejected')),
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.arco_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit ARCO request"
  ON public.arco_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can read ARCO requests"
  ON public.arco_requests FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update ARCO requests"
  ON public.arco_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_arco_requests_updated_at
  BEFORE UPDATE ON public.arco_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_arco_requests_status_created ON public.arco_requests(status, created_at DESC);