-- Fix SECURITY DEFINER view by recreating with SECURITY INVOKER
-- This ensures the view respects RLS policies of the querying user

-- Drop existing view
DROP VIEW IF EXISTS public.payout_settings_public;

-- Recreate with security_invoker = true
CREATE VIEW public.payout_settings_public
WITH (security_invoker = true)
AS
SELECT commission_percentage, payout_frequency
FROM public.payout_settings
WHERE id = 'default';

-- Grant access to authenticated and anon users (public info)
GRANT SELECT ON public.payout_settings_public TO authenticated, anon;