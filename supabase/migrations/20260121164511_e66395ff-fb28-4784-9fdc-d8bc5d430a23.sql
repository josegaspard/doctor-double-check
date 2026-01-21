-- Add onboarding_completed field to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Mark existing users as having completed onboarding (they registered through the normal flow)
UPDATE public.profiles SET onboarding_completed = true WHERE onboarding_completed = false;