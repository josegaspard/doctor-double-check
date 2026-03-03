
CREATE TABLE public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transaction_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_refund_request_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected', 'processed') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_refund_request_status_trigger
BEFORE INSERT OR UPDATE ON public.refund_requests
FOR EACH ROW EXECUTE FUNCTION public.validate_refund_request_status();

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own requests" ON public.refund_requests 
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users and admins can view requests" ON public.refund_requests 
FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update requests" ON public.refund_requests 
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
