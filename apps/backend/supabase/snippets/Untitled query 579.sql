-- =============================================================================
-- Migration: Lock down RLS — deny all non-service-role access
--
-- All data access goes through the Fastify backend using the service-role key,
-- which bypasses RLS automatically. With RLS enabled and zero permissive
-- policies, the anon and authenticated roles cannot read or write any row
-- via PostgREST, even if someone extracts the anon key from the frontend
-- build.
--
-- Storage buckets (avatars, chat-images) are marked public=true so images
-- are served without auth via the public URL endpoint. All uploads go
-- through the backend (service-role), so storage INSERT/UPDATE/DELETE
-- policies are also removed.
--
-- No backend changes required.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Performance indexes (useful regardless of RLS strategy)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_group_members_user_id
  ON public.group_members (user_id);

CREATE INDEX IF NOT EXISTS idx_channels_group_id
  ON public.channels (group_id);


-- =============================================================================
-- 1. Drop ALL existing RLS policies on data tables
-- =============================================================================

-- ---- profiles ----
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;

-- ---- groups ----
DROP POLICY IF EXISTS "groups_read" ON public.groups;

-- ---- group_members ----
DROP POLICY IF EXISTS "group_members_read" ON public.group_members;

-- ---- channels ----
DROP POLICY IF EXISTS "channels_read" ON public.channels;

-- ---- messages ----
DROP POLICY IF EXISTS "messages_read" ON public.messages;

-- ---- push_subscriptions ----
DROP POLICY IF EXISTS "Users can read own push subscriptions" ON public.push_subscriptions;

-- ---- group_invites ----
DROP POLICY IF EXISTS "group_invites_read" ON public.group_invites;

-- ---- message_reactions ----
DROP POLICY IF EXISTS "channel members can view reactions" ON public.message_reactions;
DROP POLICY IF EXISTS "users can add reactions"            ON public.message_reactions;
DROP POLICY IF EXISTS "users can remove reactions"         ON public.message_reactions;


-- =============================================================================
-- 2. Drop ALL existing RLS policies on storage.objects
--    (public buckets serve reads without RLS; uploads use service-role)
-- =============================================================================

-- avatars bucket
DROP POLICY IF EXISTS "avatars_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_own"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own"   ON storage.objects;

-- chat-images bucket
DROP POLICY IF EXISTS "chat_images_public_read"            ON storage.objects;
DROP POLICY IF EXISTS "chat_images_insert_authenticated"   ON storage.objects;
DROP POLICY IF EXISTS "chat_images_delete_own"             ON storage.objects;


-- =============================================================================
-- 3. Confirm RLS is enabled on every table (idempotent — safe to re-run)
-- =============================================================================
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invites      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions  ENABLE ROW LEVEL SECURITY;

-- No new policies are created. With RLS enabled and no permissive policies,
-- the anon and authenticated roles have zero access. The service-role key
-- used by the Fastify backend bypasses RLS entirely.
