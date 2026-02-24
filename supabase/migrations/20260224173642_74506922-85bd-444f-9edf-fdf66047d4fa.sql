-- Fix search_path on update_doctor_rating function
CREATE OR REPLACE FUNCTION public.update_doctor_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.doctor_profiles
  SET rating = COALESCE((
    SELECT ROUND(AVG(r.rating)::numeric, 1)
    FROM public.consultation_ratings r
    WHERE r.doctor_id = COALESCE(NEW.doctor_id, OLD.doctor_id)
  ), 0)
  WHERE user_id = COALESCE(NEW.doctor_id, OLD.doctor_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;