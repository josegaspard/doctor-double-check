
-- Table for users to register their bank account for refunds
CREATE TABLE public.user_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  bank_name TEXT NOT NULL,
  clabe VARCHAR(18) NOT NULL,
  clabe_last4 VARCHAR(4) NOT NULL,
  account_holder_name TEXT NOT NULL,
  rfc VARCHAR(13),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bank account"
  ON public.user_bank_accounts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all bank accounts"
  ON public.user_bank_accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Expand refund_requests with method and tracking fields
ALTER TABLE public.refund_requests
  ADD COLUMN IF NOT EXISTS refund_method TEXT DEFAULT 'wallet',
  ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT,
  ADD COLUMN IF NOT EXISTS bank_transfer_reference TEXT,
  ADD COLUMN IF NOT EXISTS bank_transfer_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estimated_completion_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS user_has_stripe BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_has_bank_account BOOLEAN DEFAULT false;

-- Update the status validation trigger to support new statuses
CREATE OR REPLACE FUNCTION public.validate_refund_request_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected', 'processed', 'pending_transfer', 'transferred', 'completed', 'awaiting_bank_details') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;
