
-- Add full Mexican bank fields to doctor_bank_accounts
ALTER TABLE public.doctor_bank_accounts 
  ADD COLUMN IF NOT EXISTS clabe VARCHAR(18),
  ADD COLUMN IF NOT EXISTS rfc VARCHAR(13),
  ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'none';

-- payment_method can be: 'stripe', 'bank', 'both', 'none'

COMMENT ON COLUMN public.doctor_bank_accounts.clabe IS 'Full 18-digit CLABE interbancaria';
COMMENT ON COLUMN public.doctor_bank_accounts.rfc IS 'RFC del doctor (persona física)';
COMMENT ON COLUMN public.doctor_bank_accounts.bank_branch IS 'Sucursal bancaria';
COMMENT ON COLUMN public.doctor_bank_accounts.payment_method IS 'Preferred payment method: stripe, bank, both, none';
