CREATE OR REPLACE FUNCTION public.process_consultation_purchase(p_doctor_id uuid, p_amount numeric, p_patient_name text DEFAULT 'Paciente'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_current_balance DECIMAL;
  v_final_amount DECIMAL;
  v_chat_session_id UUID;
  v_consultation_id UUID;
  v_user_role app_role;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No authenticated user');
  END IF;
  
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  
  SELECT role INTO v_user_role FROM user_roles WHERE user_id = v_user_id LIMIT 1;
  
  SELECT balance INTO v_current_balance 
  FROM wallets 
  WHERE user_id = v_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  v_final_amount := get_price_for_user(p_amount, v_user_id);
  
  IF v_current_balance < v_final_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  SELECT id INTO v_chat_session_id
  FROM chat_sessions
  WHERE ((participant1_id = v_user_id AND participant2_id = p_doctor_id)
     OR (participant1_id = p_doctor_id AND participant2_id = v_user_id))
    AND status = 'active'
    AND is_double_check = false
  LIMIT 1;
  
  IF v_chat_session_id IS NULL THEN
    INSERT INTO chat_sessions (
      participant1_id, participant1_type, participant2_id, participant2_type, status, is_double_check
    )
    VALUES (
      v_user_id, COALESCE(v_user_role::text, 'patient')::chat_participant_type, p_doctor_id, 'doctor', 'active', false
    )
    RETURNING id INTO v_chat_session_id;
  END IF;
  
  INSERT INTO consultations (patient_id, doctor_id, chat_session_id, status)
  VALUES (v_user_id, p_doctor_id, v_chat_session_id, 'active')
  RETURNING id INTO v_consultation_id;
  
  INSERT INTO wallet_transactions (user_id, type, amount, description, status, metadata)
  VALUES (v_user_id, 'purchase', -v_final_amount, 'Consulta médica por chat', 'paid', 
          jsonb_build_object('doctor_id', p_doctor_id, 'type', 'consultation', 'consultation_id', v_consultation_id, 'session_id', v_chat_session_id));
  
  UPDATE wallets 
  SET balance = balance - v_final_amount, updated_at = now()
  WHERE user_id = v_user_id;
  
  -- UPSERT: renew entitlement if it already exists instead of failing
  INSERT INTO entitlements (user_id, type, is_active, expires_at)
  VALUES (v_user_id, 'chat', true, now() + interval '30 days')
  ON CONFLICT (user_id, type) 
  DO UPDATE SET is_active = true, expires_at = GREATEST(entitlements.expires_at, now()) + interval '30 days';
  
  UPDATE doctor_profiles
  SET pending_earnings = COALESCE(pending_earnings, 0) + v_final_amount
  WHERE user_id = p_doctor_id;
  
  INSERT INTO wallet_transactions (user_id, type, amount, description, status, metadata)
  VALUES (p_doctor_id, 'earning', v_final_amount, 'Ganancia por consulta médica', 'paid',
          jsonb_build_object('patient_id', v_user_id, 'source', 'consultation', 'consultation_id', v_consultation_id));
  
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (p_doctor_id, 'chat_message', '💬 Nueva consulta pagada',
          p_patient_name || ' ha pagado una consulta contigo',
          jsonb_build_object('patient_id', v_user_id, 'url', '/chat', 'session_id', v_chat_session_id));
  
  RETURN jsonb_build_object(
    'success', true, 
    'amount_charged', v_final_amount, 
    'new_balance', v_current_balance - v_final_amount,
    'session_id', v_chat_session_id,
    'consultation_id', v_consultation_id
  );
END;
$function$;