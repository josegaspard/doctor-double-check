
-- Referral Program Tables
CREATE TABLE public.referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code TEXT NOT NULL UNIQUE,
  uses_count INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER DEFAULT NULL,
  discount_percentage NUMERIC NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.referral_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code_id UUID NOT NULL REFERENCES public.referral_codes(id),
  referred_user_id UUID NOT NULL,
  referrer_user_id UUID NOT NULL,
  discount_applied NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(referred_user_id)
);

-- Electronic Prescriptions Table
CREATE TABLE public.prescriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  consultation_id UUID REFERENCES public.consultations(id),
  patient_name TEXT NOT NULL,
  patient_age TEXT,
  diagnosis TEXT,
  medications JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions TEXT,
  notes TEXT,
  doctor_name TEXT NOT NULL,
  doctor_specialty TEXT NOT NULL,
  doctor_license TEXT NOT NULL,
  doctor_cedula TEXT,
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for referral_codes
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral codes"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own referral codes"
  ON public.referral_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view active codes for validation"
  ON public.referral_codes FOR SELECT
  USING (is_active = true);

-- RLS for referral_redemptions
ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own redemptions"
  ON public.referral_redemptions FOR SELECT
  USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

CREATE POLICY "System can create redemptions"
  ON public.referral_redemptions FOR INSERT
  WITH CHECK (auth.uid() = referred_user_id);

-- RLS for prescriptions
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors can manage own prescriptions"
  ON public.prescriptions FOR ALL
  USING (auth.uid() = doctor_id);

CREATE POLICY "Patients can view own prescriptions"
  ON public.prescriptions FOR SELECT
  USING (auth.uid() = patient_id);

-- Function to redeem a referral code
CREATE OR REPLACE FUNCTION public.redeem_referral_code(p_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_code_record RECORD;
  v_wallet_bonus NUMERIC := 50; -- $50 MXN bonus for both
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No authenticated');
  END IF;

  -- Check if user already redeemed a code
  IF EXISTS (SELECT 1 FROM referral_redemptions WHERE referred_user_id = v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya has usado un código de referido');
  END IF;

  -- Find the code
  SELECT * INTO v_code_record FROM referral_codes 
  WHERE code = UPPER(p_code) AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código inválido o expirado');
  END IF;

  -- Can't use own code
  IF v_code_record.user_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'No puedes usar tu propio código');
  END IF;

  -- Check max uses
  IF v_code_record.max_uses IS NOT NULL AND v_code_record.uses_count >= v_code_record.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este código ha alcanzado su límite de usos');
  END IF;

  -- Create redemption
  INSERT INTO referral_redemptions (referral_code_id, referred_user_id, referrer_user_id, discount_applied)
  VALUES (v_code_record.id, v_user_id, v_code_record.user_id, v_wallet_bonus);

  -- Update uses count
  UPDATE referral_codes SET uses_count = uses_count + 1 WHERE id = v_code_record.id;

  -- Add wallet bonus to referred user
  UPDATE wallets SET balance = balance + v_wallet_bonus WHERE user_id = v_user_id;
  INSERT INTO wallet_transactions (user_id, type, amount, description, status)
  VALUES (v_user_id, 'topup', v_wallet_bonus, 'Bono por código de referido', 'paid');

  -- Add wallet bonus to referrer
  UPDATE wallets SET balance = balance + v_wallet_bonus WHERE user_id = v_code_record.user_id;
  INSERT INTO wallet_transactions (user_id, type, amount, description, status)
  VALUES (v_code_record.user_id, 'topup', v_wallet_bonus, 'Bono por referido exitoso', 'paid');

  -- Notify referrer
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (v_code_record.user_id, 'system', '🎉 ¡Referido exitoso!', 
          'Alguien usó tu código de referido. Se agregaron $50 MXN a tu wallet.',
          jsonb_build_object('type', 'referral_bonus', 'amount', v_wallet_bonus));

  RETURN jsonb_build_object('success', true, 'bonus', v_wallet_bonus);
END;
$$;

-- Trigger for prescriptions updated_at
CREATE TRIGGER update_prescriptions_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
