
-- Add location, chat_mode, chat_price to lives table
ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS chat_mode TEXT NOT NULL DEFAULT 'free';
ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS chat_price NUMERIC NOT NULL DEFAULT 0;

-- Add is_paid and highlight_until to live_chat_messages table
ALTER TABLE public.live_chat_messages ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.live_chat_messages ADD COLUMN IF NOT EXISTS highlight_until TIMESTAMPTZ;

-- Add 'presentation' to content_type enum
ALTER TYPE public.content_type ADD VALUE IF NOT EXISTS 'presentation';

-- Add 'Cirugía General' specialty value (for documentation, specialties are stored as text)
