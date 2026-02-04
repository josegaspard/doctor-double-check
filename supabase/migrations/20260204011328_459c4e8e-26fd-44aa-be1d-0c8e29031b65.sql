-- Fix 1: consultation_ratings - restrict public access to authenticated users only
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.consultation_ratings;

CREATE POLICY "Authenticated users can view ratings"
ON public.consultation_ratings FOR SELECT
TO authenticated
USING (true);

-- Fix 2: payout_settings - restrict to admin only (remove public access)
DROP POLICY IF EXISTS "Anyone can view payout settings" ON public.payout_settings;

CREATE POLICY "Admins can view payout settings"
ON public.payout_settings FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Doctors need to see commission info for their earnings page, create a view instead
CREATE OR REPLACE VIEW public.payout_settings_public AS
SELECT 
  commission_percentage,
  payout_frequency
FROM public.payout_settings
WHERE id = 'default';

GRANT SELECT ON public.payout_settings_public TO authenticated;

-- Fix 3: notify_subscribers - add authorization check
CREATE OR REPLACE FUNCTION public.notify_subscribers(
  p_doctor_id UUID,
  p_notification_type public.notification_type,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Validate caller is the doctor or admin
  IF p_doctor_id != auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: can only notify own subscribers';
  END IF;

  -- Insert notifications for all active subscribers of the doctor
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT 
    s.subscriber_id,
    p_notification_type,
    p_title,
    p_message,
    p_data
  FROM public.subscriptions s
  WHERE s.creator_id = p_doctor_id
    AND s.is_active = true
    AND (
      (p_notification_type = 'doctor_live' AND s.notify_on_live = true) OR
      (p_notification_type = 'new_content' AND s.notify_on_content = true) OR
      (p_notification_type = 'doctor_availability' AND s.notify_on_availability = true) OR
      p_notification_type NOT IN ('doctor_live', 'new_content', 'doctor_availability')
    );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;