
-- Atomic function to process a payout: deduct pending_earnings and add to total_earnings
-- Prevents race conditions by doing everything in a single transaction with row locking
CREATE OR REPLACE FUNCTION public.process_doctor_payout(
  p_doctor_id UUID,
  p_payout_amount NUMERIC,
  p_gross_amount NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_pending NUMERIC;
  v_current_total NUMERIC;
BEGIN
  -- Lock the row to prevent concurrent updates
  SELECT pending_earnings, total_earnings
  INTO v_current_pending, v_current_total
  FROM doctor_profiles
  WHERE user_id = p_doctor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Doctor profile not found');
  END IF;

  IF v_current_pending < p_gross_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient pending earnings');
  END IF;

  -- Atomic update: deduct pending, add to total
  UPDATE doctor_profiles
  SET pending_earnings = pending_earnings - p_gross_amount,
      total_earnings = COALESCE(total_earnings, 0) + p_gross_amount
  WHERE user_id = p_doctor_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_pending', v_current_pending - p_gross_amount,
    'new_total', COALESCE(v_current_total, 0) + p_gross_amount
  );
END;
$$;

-- Atomic function to credit doctor earnings (prevents read-then-write race)
CREATE OR REPLACE FUNCTION public.credit_doctor_earnings(
  p_doctor_id UUID,
  p_amount NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_pending NUMERIC;
BEGIN
  UPDATE doctor_profiles
  SET pending_earnings = COALESCE(pending_earnings, 0) + p_amount
  WHERE user_id = p_doctor_id
  RETURNING pending_earnings INTO v_new_pending;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  RETURN v_new_pending;
END;
$$;
