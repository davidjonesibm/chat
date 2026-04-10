-- Add image dimension columns for aspect-ratio placeholders
ALTER TABLE public.messages ADD COLUMN image_width  smallint;
ALTER TABLE public.messages ADD COLUMN image_height smallint;
