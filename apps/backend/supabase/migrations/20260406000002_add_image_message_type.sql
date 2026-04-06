-- Add image_url column to messages
ALTER TABLE public.messages ADD COLUMN image_url text;

-- Drop and recreate the type CHECK constraint to add 'image'
ALTER TABLE public.messages DROP CONSTRAINT messages_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_type_check CHECK (type IN ('text', 'system', 'giphy', 'image'));
