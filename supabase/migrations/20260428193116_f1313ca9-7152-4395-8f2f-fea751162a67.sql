
-- Phase 5.1: Reply-to in chat messages
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to ON public.chat_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- Phase 5.2: Doctor side-chat in lives (only doctors/residents can read & write)
CREATE TABLE IF NOT EXISTS public.live_doctor_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id UUID NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_specialty TEXT,
  content TEXT NOT NULL,
  reply_to_id UUID REFERENCES public.live_doctor_chat(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_doctor_chat_live ON public.live_doctor_chat(live_id, created_at DESC);

ALTER TABLE public.live_doctor_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors and residents can read side-chat"
ON public.live_doctor_chat FOR SELECT
TO authenticated
USING (
  public.is_approved_doctor(auth.uid()) OR public.is_approved_resident(auth.uid())
);

CREATE POLICY "Doctors and residents can post side-chat"
ON public.live_doctor_chat FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (public.is_approved_doctor(auth.uid()) OR public.is_approved_resident(auth.uid()))
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_doctor_chat;

-- Phase 5.3: RPC to list subscribers for a creator (doctor/resident)
CREATE OR REPLACE FUNCTION public.get_my_subscribers()
RETURNS TABLE (
  subscriber_id UUID,
  name TEXT,
  avatar_url TEXT,
  email TEXT,
  tier subscription_tier,
  price_paid NUMERIC,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.subscriber_id,
    p.name,
    p.avatar_url,
    p.email,
    s.tier,
    s.price_paid,
    s.is_active,
    s.created_at,
    s.expires_at
  FROM public.subscriptions s
  JOIN public.profiles p ON p.id = s.subscriber_id
  WHERE s.creator_id = auth.uid()
  ORDER BY s.is_active DESC, s.created_at DESC;
$$;
