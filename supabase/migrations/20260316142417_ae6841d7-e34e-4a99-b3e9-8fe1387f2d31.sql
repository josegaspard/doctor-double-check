CREATE POLICY "Admins can view all wallet transactions"
ON public.wallet_transactions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));