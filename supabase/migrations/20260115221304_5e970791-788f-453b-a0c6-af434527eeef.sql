-- Fix overly permissive INSERT policy on notifications
-- The system needs to create notifications via RPC function (SECURITY DEFINER)
-- so we don't need a permissive INSERT policy for regular users

DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Users can only create notifications for themselves (for testing/manual triggers)
CREATE POLICY "Users can create own notifications" 
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() = user_id);