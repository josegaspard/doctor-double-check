-- Table to persist live chat messages for recording playback
CREATE TABLE public.live_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  content text NOT NULL,
  elapsed_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_live_chat_messages_live_id ON public.live_chat_messages(live_id, elapsed_seconds);

ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read live chat messages"
  ON public.live_chat_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own chat messages"
  ON public.live_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;