ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);