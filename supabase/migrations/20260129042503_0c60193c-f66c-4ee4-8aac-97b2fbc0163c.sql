-- Create a function to process consultation purchase via wallet
-- This handles both the wallet deduction AND credits the doctor
CREATE OR REPLACE FUNCTION public.process_consultation_purchase(
  p_doctor_id UUID,
  p_amount NUMERIC,
  p_patient_name TEXT DEFAULT 'Paciente'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current_balance DECIMAL;
  v_final_amount DECIMAL;
  v_doctor_pending DECIMAL;
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
  VALUES (v_user_id, 'purchase', -v_final_amount, 'Consulta médica por chat', 'paid', 
          jsonb_build_object('doctor_id', p_doctor_id, 'type', 'consultation'));
  
  -- Update wallet balance atomically
  UPDATE wallets 
  SET balance = balance - v_final_amount, updated_at = now()
  WHERE user_id = v_user_id;
  
  -- Create chat entitlement for patient (valid for 30 days)
  INSERT INTO entitlements (user_id, type, is_active, expires_at)
  VALUES (v_user_id, 'chat', true, now() + interval '30 days');
  
  -- Credit doctor pending earnings
  UPDATE doctor_profiles
  SET pending_earnings = COALESCE(pending_earnings, 0) + v_final_amount
  WHERE user_id = p_doctor_id;
  
  -- Create earning transaction for doctor
  INSERT INTO wallet_transactions (user_id, type, amount, description, status, metadata)
  VALUES (p_doctor_id, 'earning', v_final_amount, 'Ganancia por consulta', 'paid',
          jsonb_build_object('patient_id', v_user_id, 'source', 'consultation'));
  
  -- Create notification for doctor
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (p_doctor_id, 'chat_message', '💬 Nueva consulta iniciada',
          p_patient_name || ' ha iniciado una consulta contigo',
          jsonb_build_object('patient_id', v_user_id, 'url', '/chat'));
  
  RETURN jsonb_build_object(
    'success', true, 
    'amount_charged', v_final_amount, 
    'new_balance', v_current_balance - v_final_amount
  );
END;
$$;