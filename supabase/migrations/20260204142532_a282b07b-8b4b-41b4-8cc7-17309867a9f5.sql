
-- Create RLS policy for profiles to allow reading basic info for all authenticated users
-- This fixes the issue where profiles_public view returns empty due to RLS on base table

-- Allow all authenticated users to read name, avatar_url from any profile
CREATE POLICY "Anyone authenticated can read profile names" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);

-- Also add a similar policy for doctor_profiles to allow reading approved doctors
CREATE POLICY "Anyone authenticated can view approved doctor profiles" 
ON public.doctor_profiles 
FOR SELECT 
TO authenticated
USING (status = 'approved');
