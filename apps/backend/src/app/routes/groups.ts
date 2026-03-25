import { FastifyInstance, FastifyRequest } from 'fastify';
import type { CreateGroupRequest, AddMemberRequest } from '@chat/shared';

function requireUser(request: FastifyRequest) {
  if (!request.user)
    throw new Error('Unauthenticated request reached route handler');
  return request.user;
}

/**
 * Group routes (all protected)
 * - POST / - Create new group with default channel
 * - GET / - List groups where user is a member
 * - GET /:groupId - Get group detail
 * - POST /:groupId/members - Add member to group
 * - DELETE /:groupId/members/:userId - Remove member from group
 * - DELETE /:groupId - Delete group
 */
export default async function (fastify: FastifyInstance) {
  // Protect ALL group routes with authentication
  fastify.addHook('preHandler', fastify.authenticate);
  /**
   * POST /api/groups
   * Create a new group with a default #general channel
   */
  fastify.post<{ Body: CreateGroupRequest }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1 },
            description: { type: 'string' },
          },
          required: ['name'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              group: { $ref: 'group#' },
              defaultChannel: { $ref: 'channel#' },
            },
          },
          400: { $ref: 'error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateGroupRequest }>, reply) => {
      const { name, description } = request.body;
      const userId = requireUser(request).id;

      // Create the group
      const { data: group, error: groupError } = await fastify.supabaseAdmin
        .from('groups')
        .insert({
          name: name.trim(),
          description: description?.trim() || '',
          owner_id: userId,
        })
        .select()
        .single();

      if (groupError) {
        fastify.log.error(groupError);
        throw fastify.httpErrors.internalServerError('Failed to create group');
      }

      // Add creator as member in group_members
      const { error: memberError } = await fastify.supabaseAdmin
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: userId,
        });

      if (memberError) {
        fastify.log.error(memberError);
        throw fastify.httpErrors.internalServerError(
          'Failed to add creator as member',
        );
      }

      // Create the default #general channel
      const { data: channel, error: channelError } = await fastify.supabaseAdmin
        .from('channels')
        .insert({
          name: 'general',
          group_id: group.id,
          description: 'General discussion',
          is_default: true,
        })
        .select()
        .single();

      if (channelError) {
        fastify.log.error(channelError);
        throw fastify.httpErrors.internalServerError(
          'Failed to create default channel',
        );
      }

      reply.code(201);
      return {
        group: {
          id: group.id,
          name: group.name,
          description: group.description || '',
          owner: group.owner_id,
          members: [userId],
          created_at: group.created_at,
          updated_at: group.updated_at,
        },
        defaultChannel: {
          id: channel.id,
          name: channel.name,
          group: channel.group_id,
          description: channel.description || '',
          is_default: channel.is_default,
          created_at: channel.created_at,
          updated_at: channel.updated_at,
        },
      };
    },
  );

  /**
   * GET /api/groups
   * List all groups where the current user is a member
   */
  fastify.get(
    '/',
    {
      schema: {
        response: {
          200: {
            type: 'array',
            items: { $ref: 'group#' },
          },
        },
      },
    },
    async (request: FastifyRequest) => {
      const userId = requireUser(request).id;

      // Query groups where user is a member via junction table
      const { data, error } = await fastify.supabaseAdmin
        .from('group_members')
        .select('groups(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false, referencedTable: 'groups' });

      if (error) {
        fastify.log.error(error);
        throw fastify.httpErrors.internalServerError('Failed to fetch groups');
      }

      // Extract groups from the nested structure, fetch members for each
      type GroupRow = {
        id: string;
        name: string;
        description: string | null;
        owner_id: string | null;
        created_at: string;
        updated_at: string;
      };
      const groups = await Promise.all(
        (data || [])
          .map((row) => row.groups as unknown as GroupRow | null)
          .filter((g): g is GroupRow => g !== null)
          .map(async (group) => {
            // Get members for this group
            const { data: members } = await fastify.supabaseAdmin
              .from('group_members')
              .select('user_id')
              .eq('group_id', group.id);

            return {
              id: group.id,
              name: group.name,
              description: group.description || '',
              owner: group.owner_id,
              members: members?.map((m) => m.user_id) || [],
              created_at: group.created_at,
              updated_at: group.updated_at,
            };
          }),
      );

      return groups;
    },
  );

  /**
   * GET /api/groups/:groupId
   * Get a single group by ID with expanded members
   */
  fastify.get<{ Params: { groupId: string } }>(
    '/:groupId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            groupId: { type: 'string' },
          },
          required: ['groupId'],
        },
        response: {
          200: { $ref: 'group#' },
          403: { $ref: 'error#' },
          404: { $ref: 'error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { groupId: string } }>) => {
      const { groupId } = request.params;
      const userId = requireUser(request).id;

      // Verify user is a member
      const { data: membership } = await fastify.supabaseAdmin
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .single();

      if (!membership) {
        throw fastify.httpErrors.forbidden('Not a member of this group');
      }

      // Get the group with member IDs
      const { data: group, error: groupError } = await fastify.supabaseAdmin
        .from('groups')
        .select('*, group_members(user_id)')
        .eq('id', groupId)
        .single();

      if (groupError) {
        if (groupError.code === 'PGRST116') {
          throw fastify.httpErrors.notFound('Group not found');
        }
        fastify.log.error(groupError);
        throw fastify.httpErrors.internalServerError('Failed to fetch group');
      }

      // Extract member IDs
      const memberIds =
        group.group_members?.map((m: { user_id: string }) => m.user_id) || [];

      // Fetch profiles separately using the collected user IDs
      const { data: profiles } = await fastify.supabaseAdmin
        .from('profiles')
        .select('id, username, name, avatar')
        .in('id', memberIds);

      return {
        id: group.id,
        name: group.name,
        description: group.description || '',
        owner: group.owner_id,
        members: memberIds,
        created_at: group.created_at,
        updated_at: group.updated_at,
      };
    },
  );

  /**
   * POST /api/groups/:groupId/members
   * Add a member to a group
   */
  fastify.post<{ Params: { groupId: string }; Body: AddMemberRequest }>(
    '/:groupId/members',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            groupId: { type: 'string' },
          },
          required: ['groupId'],
        },
        body: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
          },
          required: ['userId'],
        },
        response: {
          200: { $ref: 'group#' },
          400: { $ref: 'error#' },
          403: { $ref: 'error#' },
          404: { $ref: 'error#' },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { groupId: string };
        Body: AddMemberRequest;
      }>,
    ) => {
      const { groupId } = request.params;
      const { userId } = request.body;
      const requestUserId = requireUser(request).id;

      // Verify request user is a member
      const { data: membership } = await fastify.supabaseAdmin
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('user_id', requestUserId)
        .single();

      if (!membership) {
        throw fastify.httpErrors.forbidden(
          'You must be a member to add others',
        );
      }

      // Check if user is already a member
      const { data: existingMember } = await fastify.supabaseAdmin
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .single();

      if (existingMember) {
        throw fastify.httpErrors.badRequest('User is already a member');
      }

      // Add the new member
      const { error } = await fastify.supabaseAdmin
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: userId,
        });

      if (error) {
        if (error.code === '23505') {
          throw fastify.httpErrors.badRequest('User is already a member');
        }
        fastify.log.error(error);
        throw fastify.httpErrors.internalServerError('Failed to add member');
      }

      // Return updated group
      const { data: group } = await fastify.supabaseAdmin
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      const { data: members } = await fastify.supabaseAdmin
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId);

      return {
        id: group.id,
        name: group.name,
        description: group.description || '',
        owner: group.owner_id,
        members: members?.map((m) => m.user_id) || [],
        created: group.created_at,
        updated: group.updated_at,
      };
    },
  );

  /**
   * DELETE /api/groups/:groupId/members/:userId
   * Remove a member from a group
   */
  fastify.delete<{ Params: { groupId: string; userId: string } }>(
    '/:groupId/members/:userId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            groupId: { type: 'string' },
            userId: { type: 'string' },
          },
          required: ['groupId', 'userId'],
        },
        response: {
          200: { $ref: 'group#' },
          400: { $ref: 'error#' },
          403: { $ref: 'error#' },
          404: { $ref: 'error#' },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { groupId: string; userId: string } }>,
    ) => {
      const { groupId, userId } = request.params;
      const requestUserId = requireUser(request).id;

      // Get the group
      const { data: group, error: groupError } = await fastify.supabaseAdmin
        .from('groups')
        .select('owner_id')
        .eq('id', groupId)
        .single();

      if (groupError) {
        if (groupError.code === 'PGRST116') {
          throw fastify.httpErrors.notFound('Group not found');
        }
        fastify.log.error(groupError);
        throw fastify.httpErrors.internalServerError('Failed to fetch group');
      }

      // Verify request user is the owner
      if (group.owner_id !== requestUserId) {
        throw fastify.httpErrors.forbidden('Only the owner can remove members');
      }

      // Can't remove the owner
      if (userId === group.owner_id) {
        throw fastify.httpErrors.badRequest('Cannot remove the group owner');
      }

      // Remove the member
      const { error: deleteError } = await fastify.supabaseAdmin
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (deleteError) {
        fastify.log.error(deleteError);
        throw fastify.httpErrors.internalServerError('Failed to remove member');
      }

      // Return updated group
      const { data: fullGroup } = await fastify.supabaseAdmin
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      const { data: members } = await fastify.supabaseAdmin
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId);

      return {
        id: fullGroup.id,
        name: fullGroup.name,
        description: fullGroup.description || '',
        owner: fullGroup.owner_id,
        members: members?.map((m) => m.user_id) || [],
        created: fullGroup.created_at,
        updated: fullGroup.updated_at,
      };
    },
  );

  /**
   * DELETE /api/groups/:groupId
   * Delete a group and all its channels (cascade via FK)
   */
  fastify.delete<{ Params: { groupId: string } }>(
    '/:groupId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            groupId: { type: 'string' },
          },
          required: ['groupId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
          403: { $ref: 'error#' },
          404: { $ref: 'error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { groupId: string } }>) => {
      const { groupId } = request.params;
      const userId = requireUser(request).id;

      // Get the group
      const { data: group, error: groupError } = await fastify.supabaseAdmin
        .from('groups')
        .select('owner_id')
        .eq('id', groupId)
        .single();

      if (groupError) {
        if (groupError.code === 'PGRST116') {
          throw fastify.httpErrors.notFound('Group not found');
        }
        fastify.log.error(groupError);
        throw fastify.httpErrors.internalServerError('Failed to fetch group');
      }

      // Verify request user is the owner
      if (group.owner_id !== userId) {
        throw fastify.httpErrors.forbidden(
          'Only the owner can delete the group',
        );
      }

      // Delete the group (cascade deletes channels, messages, and memberships)
      const { error: deleteError } = await fastify.supabaseAdmin
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (deleteError) {
        fastify.log.error(deleteError);
        throw fastify.httpErrors.internalServerError('Failed to delete group');
      }

      return { success: true };
    },
  );
}
