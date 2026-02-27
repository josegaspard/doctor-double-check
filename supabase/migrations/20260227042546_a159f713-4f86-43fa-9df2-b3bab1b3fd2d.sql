
-- Add peak_viewers to lives table
ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS peak_viewers integer NOT NULL DEFAULT 0;

-- Add peak_viewers to recordings table
ALTER TABLE public.recordings ADD COLUMN IF NOT EXISTS peak_viewers integer NOT NULL DEFAULT 0;

-- Allow participants to DELETE their own closed chat sessions
CREATE POLICY "Participants can delete closed sessions"
  ON public.chat_sessions
  FOR DELETE
  USING (
    status = 'closed'
    AND (auth.uid() = participant1_id OR auth.uid() = participant2_id)
  );

-- Allow cascading delete of chat_messages when session is deleted
-- First check if cascade exists, if not alter
DO $$
BEGIN
  -- Drop existing FK and re-add with CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chat_messages_session_id_fkey'
  ) THEN
    ALTER TABLE public.chat_messages DROP CONSTRAINT chat_messages_session_id_fkey;
    ALTER TABLE public.chat_messages 
      ADD CONSTRAINT chat_messages_session_id_fkey 
      FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;
  END IF;
END $$;
