-- Atomic group creation: creates group + owner membership + default #general channel
-- in a single transaction. Returns JSON matching the CreateGroupResponse shape.
create or replace function public.create_group_with_defaults(
  p_name text,
  p_description text,
  p_owner_id uuid
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group  record;
  v_channel record;
begin
  -- 1. Create the group
  insert into public.groups (name, description, owner_id)
  values (p_name, coalesce(p_description, ''), p_owner_id)
  returning * into v_group;

  -- 2. Add the creator as a member
  insert into public.group_members (group_id, user_id)
  values (v_group.id, p_owner_id);

  -- 3. Create the default #general channel
  insert into public.channels (name, group_id, description, is_default)
  values ('general', v_group.id, 'General discussion', true)
  returning * into v_channel;

  -- Return the combined result as JSON matching CreateGroupResponse
  return json_build_object(
    'group', json_build_object(
      'id', v_group.id,
      'name', v_group.name,
      'description', coalesce(v_group.description, ''),
      'owner', v_group.owner_id,
      'members', json_build_array(p_owner_id),
      'created_at', v_group.created_at,
      'updated_at', v_group.updated_at
    ),
    'defaultChannel', json_build_object(
      'id', v_channel.id,
      'name', v_channel.name,
      'group', v_channel.group_id,
      'description', coalesce(v_channel.description, ''),
      'is_default', v_channel.is_default,
      'created_at', v_channel.created_at,
      'updated_at', v_channel.updated_at
    )
  );
end;
$$;
