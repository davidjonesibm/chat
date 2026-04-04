import { randomBytes } from 'node:crypto';
import { FastifyInstance, FastifyRequest } from 'fastify';
import type {
  CreateInviteRequest,
  CreateInviteResponse,
  InviteInfoResponse,
  JoinViaInviteResponse,
} from '@chat/shared';

function requireUser(request: FastifyRequest) {
  if (!request.user)
    throw new Error('Unauthenticated request reached route handler');
  return request.user;
}

/**
 * Invite routes (all protected)
 * - POST / - Create invite (group owner only)
 * - GET /:token - Preview invite info
 * - POST /:token/join - Join group via invite
 * - DELETE /:token - Revoke invite (creator or group owner)
 * - GET /group/:groupId - List active invites for a group (owner only)
 */
export default async function (fastify: FastifyInstance) {
  // Protect ALL invite routes with authentication
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * POST /api/invites
   * Create an invite link for a group (owner only)
   */
  fastify.post<{ Body: CreateInviteRequest }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            groupId: { type: 'string' },
            expiresInHours: { type: 'number', minimum: 1 },
            maxUses: { type: ['integer', 'null'], minimum: 1 },
          },
          required: ['groupId'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              invite: { $ref: 'groupInvite#' },
            },
          },
          403: { $ref: 'error#' },
          404: { $ref: 'error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateInviteRequest }>, reply) => {
      const { groupId, expiresInHours = 168, maxUses } = request.body;
      const userId = requireUser(request).id;

      // Verify group exists and user is the owner
      const { data: group, error: groupError } = await fastify.supabaseAdmin
        .from('groups')
        .select('id, owner_id')
        .eq('id', groupId)
        .single();

      if (groupError || !group) {
        throw fastify.httpErrors.notFound('Group not found');
      }

      if (group.owner_id !== userId) {
        throw fastify.httpErrors.forbidden(
          'Only the group owner can create invites',
        );
      }

      const token = randomBytes(24).toString('hex');
      const expires_at = new Date(
        Date.now() + expiresInHours * 3600 * 1000,
      ).toISOString();

      const { data: invite, error: insertError } = await fastify.supabaseAdmin
        .from('group_invites')
        .insert({
          token,
          group_id: groupId,
          created_by: userId,
          expires_at,
          max_uses: maxUses ?? null,
        })
        .select()
        .single();

      if (insertError) {
        fastify.log.error(insertError);
        throw fastify.httpErrors.internalServerError('Failed to create invite');
      }

      reply.code(201);
      return {
        invite: {
          id: invite.id,
          token: invite.token,
          group_id: invite.group_id,
          created_by: invite.created_by,
          expires_at: invite.expires_at,
          max_uses: invite.max_uses,
          use_count: invite.use_count,
          created_at: invite.created_at,
          updated_at: invite.updated_at,
        },
      } satisfies CreateInviteResponse;
    },
  );

  /**
   * GET /api/invites/:token
   * Preview invite info (any authenticated user)
   */
  fastify.get<{ Params: { token: string } }>(
    '/:token',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            token: { type: 'string' },
          },
          required: ['token'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              groupId: { type: 'string' },
              groupName: { type: 'string' },
              groupDescription: { type: 'string' },
              memberCount: { type: 'integer' },
              inviterName: { type: 'string' },
              expiresAt: { type: 'string' },
              alreadyMember: { type: 'boolean' },
            },
          },
          404: { $ref: 'error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { token: string } }>) => {
      const { token } = request.params;
      const userId = requireUser(request).id;

      // Look up valid (non-expired, non-exhausted) invite
      const { data: invite, error: inviteError } = await fastify.supabaseAdmin
        .from('group_invites')
        .select('*')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (inviteError || !invite) {
        throw fastify.httpErrors.notFound('Invite not found or expired');
      }

      // Check max_uses exhaustion
      if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
        throw fastify.httpErrors.notFound('Invite not found or expired');
      }

      // Get group info
      const { data: group } = await fastify.supabaseAdmin
        .from('groups')
        .select('id, name, description')
        .eq('id', invite.group_id)
        .single();

      if (!group) {
        throw fastify.httpErrors.notFound('Group not found');
      }

      // Count members
      const { count: memberCount } = await fastify.supabaseAdmin
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', invite.group_id);

      // Get inviter display name from profiles
      const { data: inviterProfile } = await fastify.supabaseAdmin
        .from('profiles')
        .select('username')
        .eq('id', invite.created_by)
        .single();

      // Check if requesting user is already a member
      const { data: existingMember } = await fastify.supabaseAdmin
        .from('group_members')
        .select('user_id')
        .eq('group_id', invite.group_id)
        .eq('user_id', userId)
        .single();

      return {
        groupId: group.id,
        groupName: group.name,
        groupDescription: group.description || '',
        memberCount: memberCount || 0,
        inviterName: inviterProfile?.username || 'Unknown',
        expiresAt: invite.expires_at,
        alreadyMember: !!existingMember,
      } satisfies InviteInfoResponse;
    },
  );

  /**
   * POST /api/invites/:token/join
   * Join a group via invite token
   */
  fastify.post<{ Params: { token: string } }>(
    '/:token/join',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            token: { type: 'string' },
          },
          required: ['token'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              group: { $ref: 'group#' },
              defaultChannel: { $ref: 'channel#' },
            },
          },
          404: { $ref: 'error#' },
          409: { $ref: 'error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { token: string } }>) => {
      const { token } = request.params;
      const userId = requireUser(request).id;

      // Look up valid invite
      const { data: invite, error: inviteError } = await fastify.supabaseAdmin
        .from('group_invites')
        .select('*')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (inviteError || !invite) {
        throw fastify.httpErrors.notFound('Invite not found or expired');
      }

      if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
        throw fastify.httpErrors.notFound('Invite not found or expired');
      }

      // Check if user is already a member
      const { data: existingMember } = await fastify.supabaseAdmin
        .from('group_members')
        .select('user_id')
        .eq('group_id', invite.group_id)
        .eq('user_id', userId)
        .single();

      if (existingMember) {
        throw fastify.httpErrors.conflict(
          'You are already a member of this group',
        );
      }

      // Add user to group
      const { error: joinError } = await fastify.supabaseAdmin
        .from('group_members')
        .insert({
          group_id: invite.group_id,
          user_id: userId,
        });

      if (joinError) {
        if (joinError.code === '23505') {
          throw fastify.httpErrors.conflict(
            'You are already a member of this group',
          );
        }
        fastify.log.error(joinError);
        throw fastify.httpErrors.internalServerError('Failed to join group');
      }

      // Atomically increment use_count using optimistic concurrency
      // The WHERE use_count = current value ensures no double-increment on race
      const { error: incError } = await fastify.supabaseAdmin
        .from('group_invites')
        .update({ use_count: invite.use_count + 1 })
        .eq('token', token)
        .eq('use_count', invite.use_count);

      if (incError) {
        fastify.log.error(incError);
        // Non-fatal: user already joined, count is best-effort
      }

      // Fetch group with members
      const { data: group } = await fastify.supabaseAdmin
        .from('groups')
        .select('*, group_members(user_id)')
        .eq('id', invite.group_id)
        .single();

      if (!group) {
        throw fastify.httpErrors.internalServerError(
          'Failed to fetch group after joining',
        );
      }

      const memberIds =
        group.group_members?.map((m: { user_id: string }) => m.user_id) || [];

      // Get default channel (first by created_at)
      const { data: defaultChannel } = await fastify.supabaseAdmin
        .from('channels')
        .select('*')
        .eq('group_id', invite.group_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      return {
        group: {
          id: group.id,
          name: group.name,
          description: group.description || '',
          owner: group.owner_id,
          members: memberIds,
          created_at: group.created_at,
          updated_at: group.updated_at,
        },
        defaultChannel: defaultChannel
          ? {
              id: defaultChannel.id,
              name: defaultChannel.name,
              group: defaultChannel.group_id,
              description: defaultChannel.description || '',
              is_default: defaultChannel.is_default,
              created_at: defaultChannel.created_at,
              updated_at: defaultChannel.updated_at,
            }
          : null,
      } satisfies JoinViaInviteResponse;
    },
  );

  /**
   * DELETE /api/invites/:token
   * Revoke an invite (creator or group owner)
   */
  fastify.delete<{ Params: { token: string } }>(
    '/:token',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            token: { type: 'string' },
          },
          required: ['token'],
        },
        response: {
          204: { type: 'null' },
          403: { $ref: 'error#' },
          404: { $ref: 'error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { token: string } }>, reply) => {
      const { token } = request.params;
      const userId = requireUser(request).id;

      // Look up invite with group info for owner check
      const { data: invite, error: inviteError } = await fastify.supabaseAdmin
        .from('group_invites')
        .select('*, groups!inner(owner_id)')
        .eq('token', token)
        .single();

      if (inviteError || !invite) {
        throw fastify.httpErrors.notFound('Invite not found');
      }

      const groupOwner = (invite.groups as unknown as { owner_id: string })
        .owner_id;

      if (invite.created_by !== userId && groupOwner !== userId) {
        throw fastify.httpErrors.forbidden(
          'Only the invite creator or group owner can revoke invites',
        );
      }

      const { error: deleteError } = await fastify.supabaseAdmin
        .from('group_invites')
        .delete()
        .eq('token', token);

      if (deleteError) {
        fastify.log.error(deleteError);
        throw fastify.httpErrors.internalServerError('Failed to revoke invite');
      }

      reply.code(204).send();
    },
  );

  /**
   * GET /api/invites/group/:groupId
   * List active invites for a group (owner only)
   */
  fastify.get<{ Params: { groupId: string } }>(
    '/group/:groupId',
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
            type: 'array',
            items: { $ref: 'groupInvite#' },
          },
          403: { $ref: 'error#' },
          404: { $ref: 'error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { groupId: string } }>) => {
      const { groupId } = request.params;
      const userId = requireUser(request).id;

      // Verify group exists and user is the owner
      const { data: group, error: groupError } = await fastify.supabaseAdmin
        .from('groups')
        .select('id, owner_id')
        .eq('id', groupId)
        .single();

      if (groupError || !group) {
        throw fastify.httpErrors.notFound('Group not found');
      }

      if (group.owner_id !== userId) {
        throw fastify.httpErrors.forbidden(
          'Only the group owner can list invites',
        );
      }

      // Return non-expired, non-exhausted invites
      const { data: invites, error: listError } = await fastify.supabaseAdmin
        .from('group_invites')
        .select('*')
        .eq('group_id', groupId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (listError) {
        fastify.log.error(listError);
        throw fastify.httpErrors.internalServerError('Failed to fetch invites');
      }

      // Filter out exhausted invites in application code because PostgREST
      // .or() cannot do column-to-column comparisons (use_count < max_uses).
      const active = (invites || []).filter(
        (inv) => inv.max_uses === null || inv.use_count < inv.max_uses,
      );

      return active.map((inv) => ({
        id: inv.id,
        token: inv.token,
        group_id: inv.group_id,
        created_by: inv.created_by,
        expires_at: inv.expires_at,
        max_uses: inv.max_uses,
        use_count: inv.use_count,
        created_at: inv.created_at,
        updated_at: inv.updated_at,
      }));
    },
  );
}
