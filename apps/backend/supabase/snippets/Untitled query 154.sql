-- Migration: M14 + M15 — updated_at triggers and handle_new_user ON CONFLICT fix
-- Safe to run on production (idempotent via CREATE OR REPLACE / DROP IF EXISTS + CREATE)

-- =============================================================================
-- M14: Auto-update `updated_at` on row modification
-- =============================================================================

-- Reusable trigger function: sets updated_at = now() before any UPDATE
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Attach the trigger to every table that carries an updated_at column.
-- Pattern: DROP IF EXISTS → CREATE ensures idempotency.

-- profiles
drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- groups
drop trigger if exists set_updated_at on public.groups;
create trigger set_updated_at
  before update on public.groups
  for each row execute function public.update_updated_at_column();

-- channels
drop trigger if exists set_updated_at on public.channels;
create trigger set_updated_at
  before update on public.channels
  for each row execute function public.update_updated_at_column();

-- messages
drop trigger if exists set_updated_at on public.messages;
create trigger set_updated_at
  before update on public.messages
  for each row execute function public.update_updated_at_column();

-- group_invites
drop trigger if exists set_updated_at on public.group_invites;
create trigger set_updated_at
  before update on public.group_invites
  for each row execute function public.update_updated_at_column();

-- message_reactions
drop trigger if exists set_updated_at on public.message_reactions;
create trigger set_updated_at
  before update on public.message_reactions
  for each row execute function public.update_updated_at_column();

-- =============================================================================
-- M15: Make handle_new_user() idempotent with ON CONFLICT
-- =============================================================================

-- If the profile row already exists (retry, re-signup, manual insert), update
-- the username and name from the latest auth metadata instead of failing.
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
  )
  on conflict (id) do update set
    username = excluded.username,
    name     = excluded.name;
  return new;
end;
$$;
