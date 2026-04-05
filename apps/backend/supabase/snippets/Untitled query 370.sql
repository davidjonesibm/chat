ALTER TABLE public.messages
  DROP CONSTRAINT messages_type_check,
  ADD CONSTRAINT messages_type_check CHECK (type IN ('text', 'system', 'giphy'));