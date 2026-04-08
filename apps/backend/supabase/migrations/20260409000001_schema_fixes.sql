-- Migration: Schema fixes for messages table
-- Addresses: H11 (seq column), H5 (sender_id ON DELETE SET NULL), M16 (channel_id NOT NULL)

-- =============================================================================
-- H11: Add messages.seq column
-- Provides an auto-incrementing sequence number for deterministic message ordering.
-- Existing rows are automatically assigned sequential values by IDENTITY.
-- =============================================================================
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS seq bigint GENERATED ALWAYS AS IDENTITY;

-- Index for efficient ordering by seq
CREATE INDEX IF NOT EXISTS idx_messages_seq ON public.messages (seq);

-- =============================================================================
-- H5: Change messages.sender_id FK from ON DELETE CASCADE to ON DELETE SET NULL
-- Preserves messages when a user is deleted instead of cascading deletion.
-- The column is already nullable and backend code handles null sender_id.
-- =============================================================================
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- =============================================================================
-- M16: Add NOT NULL constraint to messages.channel_id
-- Clean up any orphaned messages with NULL channel_id first, then enforce constraint.
-- =============================================================================
DELETE FROM public.messages WHERE channel_id IS NULL;

ALTER TABLE public.messages
  ALTER COLUMN channel_id SET NOT NULL;
