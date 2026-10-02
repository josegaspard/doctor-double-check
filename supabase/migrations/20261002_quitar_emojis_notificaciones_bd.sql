-- Quita los emojis de los títulos de notificación que aún generan 3 funciones de la BD
-- (✅/❌ pago confirmado/rechazado, 💬 nueva consulta pagada, 🎉 referido exitoso).
-- El resto de cada función queda idéntico al de producción del 2-oct-2026.
CREATE OR REPLACE FUNCTION public.notify_wallet_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'paid' AND OLD.status IN ('initiated','pending') THEN
      INSERT INTO public.notifications(user_id, type, title, message, data)
      VALUES (NEW.user_id, 'system', 'Pago confirmado',
              COALESCE(NEW.description, 'Tu pago ha sido confirmado.'),
              jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount, 'status', 'paid'));
    ELSIF NEW.status = 'failed' AND OLD.status IN ('initiated','pending') THEN
      INSERT INTO public.notifications(user_id, type, title, message, data)
      VALUES (NEW.user_id, 'system', 'Pago rechazado',
              COALESCE(NEW.description, 'Tu pago no se pudo procesar') || ' — intenta de nuevo o contacta soporte.',
              jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount, 'status', 'failed'));
    END IF;
  END IF;
  RETURN NEW;
END;
$function$

;

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
  VALUES (p_doctor_id, 'chat_message', 'Nueva consulta pagada',
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
$function$

;

CREATE OR REPLACE FUNCTION public.redeem_referral_code(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_code_record RECORD;
  v_wallet_bonus NUMERIC := 50; -- $50 MXN bonus for both
  v_default_max_uses INT := 20;         -- tope por código si no tiene max_uses propio
  v_max_per_referrer INT := 50;         -- tope de canjes de por vida por referidor
  v_effective_max_uses INT;
  v_referrer_total INT;
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

  -- Check max uses (con default cuando el código no define uno propio)
  v_effective_max_uses := COALESCE(v_code_record.max_uses, v_default_max_uses);
  IF v_code_record.uses_count >= v_effective_max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este código ha alcanzado su límite de usos');
  END IF;

  -- Cap de por vida por referidor: cuenta TODOS los canjes ya acreditados a este
  -- referidor (sumando todos sus códigos). Frena el farmeo con múltiples cuentas.
  SELECT count(*) INTO v_referrer_total
  FROM referral_redemptions WHERE referrer_user_id = v_code_record.user_id;
  IF v_referrer_total >= v_max_per_referrer THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este referidor alcanzó el límite de referidos permitidos');
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
  VALUES (v_code_record.user_id, 'system', '¡Referido exitoso!',
          'Alguien usó tu código de referido. Se agregaron $50 MXN a tu wallet.',
          jsonb_build_object('type', 'referral_bonus', 'amount', v_wallet_bonus));

  RETURN jsonb_build_object('success', true, 'bonus', v_wallet_bonus);
END;
$function$

;

