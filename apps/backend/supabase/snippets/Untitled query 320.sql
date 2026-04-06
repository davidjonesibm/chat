-- Strip full Supabase origin URLs down to pathnames for storage references.
-- Only affects rows where the URL starts with "http" and contains "/storage/".

-- 1. profiles.avatar
UPDATE profiles
SET avatar = '/storage' || split_part(avatar, '/storage', 2)
WHERE avatar LIKE 'http%/storage/%';

-- 2. messages.image_url
UPDATE messages
SET image_url = '/storage' || split_part(image_url, '/storage', 2)
WHERE image_url LIKE 'http%/storage/%';

-- 3. auth.users.raw_user_meta_data->avatar
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  raw_user_meta_data,
  '{avatar}',
  to_jsonb('/storage' || split_part(raw_user_meta_data->>'avatar', '/storage', 2))
)
WHERE raw_user_meta_data->>'avatar' LIKE 'http%/storage/%';
