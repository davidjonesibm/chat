-- profiles table (extends auth.users via FK)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique,
  name text,
  avatar text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- groups table
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- group_members junction table (replaces PocketBase groups.members multi-relation)
create table if not exists public.group_members (
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  primary key (group_id, user_id)
);

-- channels table
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  group_id uuid references public.groups(id) on delete cascade not null,
  description text,
  is_default boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  channel_id uuid references public.channels(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('text', 'system')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Trigger: automatically create profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username, name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'name'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS: Enable but allow service_role to bypass (service role key bypasses RLS automatically)
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;

-- Basic RLS policies (allow authenticated users to read all, only allow service_role writes via backend)
create policy "profiles_read" on public.profiles for select using (auth.role() = 'authenticated');
create policy "groups_read" on public.groups for select using (auth.role() = 'authenticated');
create policy "group_members_read" on public.group_members for select using (auth.role() = 'authenticated');
create policy "channels_read" on public.channels for select using (auth.role() = 'authenticated');
create policy "messages_read" on public.messages for select using (auth.role() = 'authenticated');
