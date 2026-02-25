
-- Add can_publish_news column to doctor_profiles
ALTER TABLE public.doctor_profiles 
ADD COLUMN can_publish_news boolean NOT NULL DEFAULT false;
