-- Group invite links for sharing join-links
create table if not exists public.group_invites (
  id          uuid primary key default gen_random_uuid(),
  token       text unique not null,
  group_id    uuid references public.groups(id) on delete cascade not null,
  created_by  uuid references auth.users(id) on delete cascade not null,
  expires_at  timestamptz not null,
  max_uses    int,                         -- null = unlimited
  use_count   int not null default 0,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

-- Index for listing invites per group
CREATE INDEX IF NOT EXISTS idx_group_invites_group_id
  ON public.group_invites (group_id);

-- RLS: service-role handles all writes; authenticated users can read
alter table public.group_invites enable row level security;

create policy "group_invites_read"
  on public.group_invites for select
  using (auth.role() = 'authenticated');
