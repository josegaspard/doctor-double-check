-- Drop the policy that blocks all deletions
DROP POLICY IF EXISTS "Email history cannot be deleted by users" ON public.email_history;

-- Create a new policy that allows doctors to delete their own email history
CREATE POLICY "Doctors can delete own email history"
  ON public.email_history
  FOR DELETE
  TO authenticated
  USING (auth.uid() = doctor_id);