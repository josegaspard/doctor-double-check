-- FIX 1: Create SECURITY DEFINER function to check vault access without recursion
CREATE OR REPLACE FUNCTION public.user_has_vault_access(p_file_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM vault_access va
    WHERE va.file_id = p_file_id
      AND va.doctor_id = p_user_id
      AND (va.expires_at IS NULL OR va.expires_at > now())
  )
$$;

-- Drop old recursive policy
DROP POLICY IF EXISTS "Doctors can view files with active access" ON vault_files;

-- Create new policy using the security definer function
CREATE POLICY "Doctors can view files with active access" ON vault_files
  FOR SELECT USING (public.user_has_vault_access(id, auth.uid()));