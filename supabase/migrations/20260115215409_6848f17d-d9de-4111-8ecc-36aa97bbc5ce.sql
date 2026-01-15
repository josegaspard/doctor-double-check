-- Add database constraint to limit chat message content length
-- Using a trigger instead of CHECK constraint for better compatibility

-- Create validation trigger function for chat_messages
CREATE OR REPLACE FUNCTION public.validate_chat_message_content()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure content is not empty after trimming
  NEW.content := TRIM(NEW.content);
  
  IF NEW.content IS NULL OR LENGTH(NEW.content) = 0 THEN
    RAISE EXCEPTION 'Message content cannot be empty';
  END IF;
  
  -- Limit message length to 10000 characters to prevent DoS
  IF LENGTH(NEW.content) > 10000 THEN
    RAISE EXCEPTION 'Message content exceeds maximum length of 10000 characters';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger on chat_messages table
DROP TRIGGER IF EXISTS validate_chat_message_content_trigger ON public.chat_messages;
CREATE TRIGGER validate_chat_message_content_trigger
  BEFORE INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_chat_message_content();