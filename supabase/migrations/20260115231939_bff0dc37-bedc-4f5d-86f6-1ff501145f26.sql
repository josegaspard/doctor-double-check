-- Create consultation_ratings table for the rating system
CREATE TABLE public.consultation_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultation_id UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL,
  doctor_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(consultation_id, patient_id)
);

-- Enable RLS
ALTER TABLE public.consultation_ratings ENABLE ROW LEVEL SECURITY;

-- Patients can create ratings for their own consultations
CREATE POLICY "Patients can rate their consultations"
ON public.consultation_ratings
FOR INSERT
WITH CHECK (
  auth.uid() = patient_id 
  AND EXISTS (
    SELECT 1 FROM consultations 
    WHERE id = consultation_id 
    AND patient_id = auth.uid() 
    AND status = 'completed'
  )
);

-- Users can view ratings
CREATE POLICY "Anyone can view ratings"
ON public.consultation_ratings
FOR SELECT
USING (true);

-- Patients can update their own ratings
CREATE POLICY "Patients can update own ratings"
ON public.consultation_ratings
FOR UPDATE
USING (auth.uid() = patient_id);

-- Create function to update doctor rating automatically
CREATE OR REPLACE FUNCTION public.update_doctor_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating DECIMAL;
BEGIN
  -- Calculate new average rating
  SELECT COALESCE(AVG(rating), 0) INTO avg_rating
  FROM public.consultation_ratings
  WHERE doctor_id = NEW.doctor_id;
  
  -- Update doctor profile
  UPDATE public.doctor_profiles
  SET rating = ROUND(avg_rating, 2)
  WHERE user_id = NEW.doctor_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-update rating
CREATE TRIGGER update_doctor_rating_trigger
AFTER INSERT OR UPDATE ON public.consultation_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_doctor_rating();

-- Add index for performance
CREATE INDEX idx_consultation_ratings_doctor ON public.consultation_ratings(doctor_id);
CREATE INDEX idx_consultation_ratings_consultation ON public.consultation_ratings(consultation_id);