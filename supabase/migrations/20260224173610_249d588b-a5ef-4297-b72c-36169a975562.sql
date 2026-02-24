-- Create or replace function to recalculate doctor rating from consultation_ratings
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_update_doctor_rating ON public.consultation_ratings;

-- Create trigger on consultation_ratings to auto-update doctor rating
CREATE TRIGGER trg_update_doctor_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.consultation_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_doctor_rating();

-- Backfill: recalculate all existing doctor ratings now
UPDATE public.doctor_profiles dp
SET rating = COALESCE(sub.avg_rating, dp.rating)
FROM (
  SELECT doctor_id, ROUND(AVG(rating)::numeric, 1) as avg_rating
  FROM public.consultation_ratings
  GROUP BY doctor_id
) sub
WHERE dp.user_id = sub.doctor_id;