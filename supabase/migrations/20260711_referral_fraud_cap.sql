-- P2-6 · Tope anti-fraude en redeem_referral_code.
-- Antes: si un código no tenía max_uses (NULL = ilimitado por default), un usuario
-- podía crear N cuentas y farmear $50 MXN por cada una para el referidor y para sí.
-- Añade DOS límites sin cambiar el resto de la lógica:
--   1) Cap por código cuando max_uses IS NULL  -> DEFAULT_MAX_USES (20).
--   2) Cap de por vida por REFERIDOR: total de canjes acreditados a ese referidor
--      (sumando todos sus códigos) no puede pasar MAX_REFERRALS_PER_REFERRER (50).
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
  VALUES (v_code_record.user_id, 'system', '🎉 ¡Referido exitoso!',
          'Alguien usó tu código de referido. Se agregaron $50 MXN a tu wallet.',
          jsonb_build_object('type', 'referral_bonus', 'amount', v_wallet_bonus));

  RETURN jsonb_build_object('success', true, 'bonus', v_wallet_bonus);
END;
$function$;
