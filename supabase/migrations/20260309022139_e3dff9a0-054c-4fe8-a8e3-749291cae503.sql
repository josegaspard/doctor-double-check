
-- Create doctor_ranks table
CREATE TABLE public.doctor_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  icon text NOT NULL DEFAULT 'shield',
  color text NOT NULL DEFAULT 'info',
  min_consultations integer NOT NULL DEFAULT 0,
  min_earnings numeric NOT NULL DEFAULT 0,
  min_months_active integer NOT NULL DEFAULT 0,
  min_rating numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.doctor_ranks ENABLE ROW LEVEL SECURITY;

-- Everyone can read ranks
CREATE POLICY "Anyone can read ranks" ON public.doctor_ranks FOR SELECT TO authenticated USING (true);

-- Only admins can manage ranks
CREATE POLICY "Admins can manage ranks" ON public.doctor_ranks FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Add rank_override to doctor_profiles
ALTER TABLE public.doctor_profiles ADD COLUMN rank_override uuid REFERENCES public.doctor_ranks(id) ON DELETE SET NULL;

-- Seed default ranks
INSERT INTO public.doctor_ranks (name, display_name, icon, color, min_consultations, min_earnings, min_months_active, min_rating, sort_order)
VALUES
  ('nuevo', 'Nuevo', 'shield', 'info', 0, 0, 0, 0, 0),
  ('activo', 'Activo', 'zap', 'success', 10, 500, 1, 3.5, 1),
  ('destacado', 'Destacado', 'award', 'warning', 30, 2000, 3, 4.0, 2),
  ('experto', 'Experto', 'star', 'premium', 75, 5000, 6, 4.5, 3),
  ('elite', 'Élite', 'crown', 'purple', 150, 15000, 12, 4.8, 4);

-- Recreate the public view to include rank_override
DROP VIEW IF EXISTS public.doctor_profiles_public;
CREATE VIEW public.doctor_profiles_public AS
SELECT
  user_id,
  id,
  rating,
  total_consultations,
  followers_count,
  consultation_fee,
  available_for_double_check,
  available_for_clinical_sessions,
  office_hours_start,
  office_hours_end,
  status,
  created_at,
  updated_at,
  specialty,
  bio,
  location,
  office_days,
  badge_override,
  rank_override
FROM doctor_profiles
WHERE status = 'approved';

-- Grant access
GRANT SELECT ON public.doctor_profiles_public TO anon, authenticated;
