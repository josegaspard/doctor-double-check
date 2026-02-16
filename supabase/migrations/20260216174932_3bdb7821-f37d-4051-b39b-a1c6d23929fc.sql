-- Allow authenticated users to view all roles (needed for comment badges, author cards, etc.)
CREATE POLICY "Authenticated users can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);