-- Add tsvector column for full-text search (auto-updates via GENERATED ALWAYS)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_messages_search_vector
  ON public.messages USING gin(search_vector);

-- Composite index for channel-scoped search with ordering
CREATE INDEX IF NOT EXISTS idx_messages_channel_created
  ON public.messages (channel_id, created_at DESC);
