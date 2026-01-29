-- =====================================================
-- PAYOUTS, INVOICES & CEDULA VERIFICATION SYSTEM
-- =====================================================

-- Doctor Bank Accounts for Stripe Connect payouts
CREATE TABLE public.doctor_bank_accounts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    doctor_id UUID NOT NULL UNIQUE,
    stripe_account_id TEXT,
    stripe_account_status TEXT DEFAULT 'pending', -- pending, active, restricted, disabled
    account_holder_name TEXT,
    bank_name TEXT,
    clabe_last4 TEXT, -- Last 4 digits of CLABE
    is_verified BOOLEAN DEFAULT false,
    onboarding_completed BOOLEAN DEFAULT false,
    payouts_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Doctor Invoices
CREATE TABLE public.doctor_invoices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    doctor_id UUID NOT NULL,
    invoice_number TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    amount NUMERIC NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    admin_notes TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Payout Records
CREATE TABLE public.doctor_payouts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    doctor_id UUID NOT NULL,
    amount NUMERIC NOT NULL,
    stripe_payout_id TEXT,
    stripe_transfer_id TEXT,
    status TEXT DEFAULT 'pending', -- pending, processing, paid, failed
    period_start DATE,
    period_end DATE,
    invoice_id UUID REFERENCES public.doctor_invoices(id),
    error_message TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Admin Payout Settings
CREATE TABLE public.payout_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    payout_frequency TEXT DEFAULT 'weekly', -- daily, weekly, biweekly, monthly
    payout_day INTEGER DEFAULT 1, -- Day of week (1-7) or day of month (1-28)
    commission_percentage NUMERIC DEFAULT 20, -- Platform commission (%)
    minimum_payout_amount NUMERIC DEFAULT 100, -- Minimum amount to trigger payout
    auto_payout_enabled BOOLEAN DEFAULT true,
    require_invoice BOOLEAN DEFAULT true,
    updated_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Cedula Verification Records (using SEP API)
CREATE TABLE public.cedula_verifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    cedula_number TEXT NOT NULL,
    nombre TEXT,
    paterno TEXT,
    materno TEXT,
    titulo TEXT,
    institucion TEXT,
    anio_registro INTEGER,
    verified_at TIMESTAMP WITH TIME ZONE,
    is_verified BOOLEAN DEFAULT false,
    is_claimed BOOLEAN DEFAULT false, -- Once verified and claimed, no one else can use it
    claimed_by UUID,
    claimed_at TIMESTAMP WITH TIME ZONE,
    raw_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index on verified cédulas to prevent duplicates
CREATE UNIQUE INDEX idx_cedula_claimed ON public.cedula_verifications(cedula_number) WHERE is_claimed = true;

-- Enable RLS on all tables
ALTER TABLE public.doctor_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cedula_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for doctor_bank_accounts
CREATE POLICY "Doctors can view own bank account" ON public.doctor_bank_accounts
    FOR SELECT USING (auth.uid() = doctor_id);

CREATE POLICY "Doctors can insert own bank account" ON public.doctor_bank_accounts
    FOR INSERT WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "Doctors can update own bank account" ON public.doctor_bank_accounts
    FOR UPDATE USING (auth.uid() = doctor_id);

CREATE POLICY "Admins can manage all bank accounts" ON public.doctor_bank_accounts
    FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for doctor_invoices
CREATE POLICY "Doctors can view own invoices" ON public.doctor_invoices
    FOR SELECT USING (auth.uid() = doctor_id);

CREATE POLICY "Doctors can upload invoices" ON public.doctor_invoices
    FOR INSERT WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "Doctors can update pending invoices" ON public.doctor_invoices
    FOR UPDATE USING (auth.uid() = doctor_id AND status = 'pending');

CREATE POLICY "Doctors can delete pending invoices" ON public.doctor_invoices
    FOR DELETE USING (auth.uid() = doctor_id AND status = 'pending');

CREATE POLICY "Admins can manage all invoices" ON public.doctor_invoices
    FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for doctor_payouts
CREATE POLICY "Doctors can view own payouts" ON public.doctor_payouts
    FOR SELECT USING (auth.uid() = doctor_id);

CREATE POLICY "Admins can manage all payouts" ON public.doctor_payouts
    FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for payout_settings
CREATE POLICY "Anyone can view payout settings" ON public.payout_settings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage payout settings" ON public.payout_settings
    FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for cedula_verifications
CREATE POLICY "Users can view own cedula verifications" ON public.cedula_verifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create cedula verifications" ON public.cedula_verifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all cedula verifications" ON public.cedula_verifications
    FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Add column to doctor_profiles to link cedula verification
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS cedula_verification_id UUID REFERENCES public.cedula_verifications(id);
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS payouts_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS total_earnings NUMERIC DEFAULT 0;
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS pending_earnings NUMERIC DEFAULT 0;

-- Create storage bucket for invoices
INSERT INTO storage.buckets (id, name, public) 
VALUES ('doctor-invoices', 'doctor-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for doctor-invoices bucket
CREATE POLICY "Doctors can upload own invoices"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'doctor-invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Doctors can view own invoices"
ON storage.objects FOR SELECT
USING (bucket_id = 'doctor-invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Doctors can delete own invoices"
ON storage.objects FOR DELETE
USING (bucket_id = 'doctor-invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all invoices storage"
ON storage.objects FOR SELECT
USING (bucket_id = 'doctor-invoices' AND has_role(auth.uid(), 'admin'));

-- Insert default payout settings
INSERT INTO public.payout_settings (id, payout_frequency, payout_day, commission_percentage, minimum_payout_amount, auto_payout_enabled, require_invoice)
VALUES ('default', 'weekly', 1, 20, 100, true, true)
ON CONFLICT (id) DO NOTHING;

-- Triggers for updated_at
CREATE TRIGGER update_doctor_bank_accounts_updated_at
    BEFORE UPDATE ON public.doctor_bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_doctor_invoices_updated_at
    BEFORE UPDATE ON public.doctor_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for payouts
ALTER PUBLICATION supabase_realtime ADD TABLE public.doctor_payouts;