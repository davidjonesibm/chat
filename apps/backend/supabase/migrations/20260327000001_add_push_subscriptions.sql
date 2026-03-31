-- Push notification subscriptions (W3C PushSubscription objects)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null,
  keys_p256dh text not null,
  keys_auth text not null,
  created_at timestamptz default now() not null,
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

-- Only authenticated users can read their own subscriptions
create policy "Users can read own push subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

-- Service role handles all writes (inserts/deletes go through the Fastify backend)
-- INSERT/UPDATE/DELETE handled exclusively via service-role (bypasses RLS)
