-- Fix #1: Profiles - Protect email addresses
-- Create a public view that excludes sensitive fields
CREATE VIEW public.public_profiles
WITH (security_invoker=on) AS
  SELECT id, name, avatar_url, created_at, updated_at
  FROM public.profiles;

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create restrictive policy - users can only see their own full profile
CREATE POLICY "Users can view own full profile" 
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Fix #2: Broken vault_files policy for doctor access
DROP POLICY IF EXISTS "Doctors can view files with access" ON public.vault_files;

CREATE POLICY "Doctors can view files with access" 
ON public.vault_files FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.vault_access va
        WHERE va.file_id = vault_files.id
        AND va.doctor_id = auth.uid()
    )
);

-- Fix #3: Wallet security - Remove user ability to update wallets directly
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;

-- Create secure wallet functions that only allow server-side modifications
CREATE OR REPLACE FUNCTION public.process_wallet_topup(
  p_amount DECIMAL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_current_balance DECIMAL;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No authenticated user');
  END IF;
  
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  
  -- Get current balance
  SELECT balance INTO v_current_balance FROM wallets WHERE user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (user_id, type, amount, description, status)
  VALUES (v_user_id, 'topup', p_amount, 'Recarga de saldo', 'paid');
  
  -- Update wallet balance atomically
  UPDATE wallets 
  SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = v_user_id;
  
  RETURN jsonb_build_object('success', true, 'new_balance', v_current_balance + p_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_wallet_purchase(
  p_amount DECIMAL,
  p_description TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_current_balance DECIMAL;
  v_final_amount DECIMAL;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No authenticated user');
  END IF;
  
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  
  -- Get current balance with row lock to prevent race conditions
  SELECT balance INTO v_current_balance 
  FROM wallets 
  WHERE user_id = v_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Calculate price (50% discount for residents)
  v_final_amount := get_price_for_user(p_amount, v_user_id);
  
  -- Check if user can afford
  IF v_current_balance < v_final_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (user_id, type, amount, description, status, metadata)
  VALUES (v_user_id, 'purchase', -v_final_amount, p_description, 'paid', p_metadata);
  
  -- Update wallet balance atomically
  UPDATE wallets 
  SET balance = balance - v_final_amount, updated_at = now()
  WHERE user_id = v_user_id;
  
  RETURN jsonb_build_object('success', true, 'amount_charged', v_final_amount, 'new_balance', v_current_balance - v_final_amount);
END;
$$;