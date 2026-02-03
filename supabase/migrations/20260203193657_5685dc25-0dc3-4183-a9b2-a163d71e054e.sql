
-- Add early_access_minutes to subscriptions for premium early access feature
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS early_access_minutes integer DEFAULT 0;

-- Update existing premium subscriptions to have 5 minutes early access
UPDATE public.subscriptions 
SET early_access_minutes = 5 
WHERE tier = 'premium' AND early_access_minutes = 0;

-- Create function to update priority score on chat sessions
CREATE OR REPLACE FUNCTION public.update_chat_priority_on_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update priority_score for all chat sessions where this subscriber is participant
  UPDATE public.chat_sessions cs
  SET priority_score = public.get_subscription_priority(
    CASE WHEN cs.participant1_type = 'patient' THEN cs.participant1_id ELSE cs.participant2_id END,
    CASE WHEN cs.participant1_type = 'doctor' THEN cs.participant1_id ELSE cs.participant2_id END
  )
  WHERE (cs.participant1_id = NEW.subscriber_id OR cs.participant2_id = NEW.subscriber_id)
    AND cs.status = 'active';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-update priority when subscription changes
DROP TRIGGER IF EXISTS on_subscription_change_update_priority ON public.subscriptions;
CREATE TRIGGER on_subscription_change_update_priority
AFTER INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_chat_priority_on_subscription_change();

-- Add rating_request to notification_type enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'rating_request' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')) THEN
    ALTER TYPE public.notification_type ADD VALUE 'rating_request';
  END IF;
END $$;
