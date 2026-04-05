-- Create message_reactions table
CREATE TABLE message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(emoji) <= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);

-- Enable RLS
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Users can read reactions for messages in channels they are members of
CREATE POLICY "channel members can view reactions"
ON message_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    JOIN channels c ON c.group_id = gm.group_id
    JOIN messages m ON m.channel_id = c.id
    WHERE m.id = message_reactions.message_id
    AND gm.user_id = auth.uid()
  )
);

-- Users can insert their own reactions
CREATE POLICY "users can add reactions"
ON message_reactions FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can delete their own reactions
CREATE POLICY "users can remove reactions"
ON message_reactions FOR DELETE
USING (user_id = auth.uid());
