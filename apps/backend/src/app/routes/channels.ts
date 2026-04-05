import { FastifyInstance, FastifyRequest } from 'fastify';
import type { CreateChannelRequest, ReactionSummary } from '@chat/shared';

function requireUser(request: FastifyRequest) {
  if (!request.user)
    throw new Error('Unauthenticated request reached route handler');
  return request.user;
}

/**
 * Channel routes (all protected)
 * - GET / - List channels in a group
 * - POST / - Create a new channel in a group
 * - GET /:channelId/messages - Get paginated message history
 * - DELETE /:channelId - Delete a channel
 */
export default async function (fastify: FastifyInstance) {
  // Protect ALL channel routes with authentication
  fastify.addHook('preHandler', fastify.authenticate);
  /**
   * GET /api/channels?groupId=xxx
   * Returns all channels in a group where the user is a member
   */
  fastify.get<{ Querystring: { groupId: string } }>(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            groupId: { type: 'string' },
          },
          required: ['groupId'],
        },
        response: {
          200: {
            type: 'array',
            items: { $ref: 'channel#' },
          },
          403: { $ref: 'error#' },
          404: { $ref: 'error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { groupId: string } }>) => {
      const { groupId } = request.query;

      // Verify user is a member of the group
      const { data: membership } = await fastify.supabaseAdmin
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('user_id', requireUser(request).id)
        .single();

      if (!membership) {
        throw fastify.httpErrors.forbidden('Not a member of this group');
      }

      // Get all channels in the group
      const { data: channels, error } = await fastify.supabaseAdmin
        .from('channels')
        .select('*')
        .eq('group_id', groupId)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

      if (error) {
        fastify.log.error(error);
        throw fastify.httpErrors.internalServerError(
          'Failed to fetch channels',
        );
      }

      return channels.map((ch) => ({
        id: ch.id,
        name: ch.name,
        group: ch.group_id,
        description: ch.description || '',
        is_default: ch.is_default,
        created_at: ch.created_at,
        updated_at: ch.updated_at,
      }));
    },
  );

  /**
   * POST /api/channels
   * Create a new channel in a group
   */
  fastify.post<{ Body: CreateChannelRequest }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1 },
            groupId: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['name', 'groupId'],
        },
        response: {
          201: { $ref: 'channel#' },
          400: { $ref: 'error#' },
          403: { $ref: 'error#' },
          404: { $ref: 'error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateChannelRequest }>, reply) => {
      const { name, groupId, description } = request.body;
      const userId = requireUser(request).id;

      // Verify user is a member of the group
      const { data: membership } = await fastify.supabaseAdmin
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .single();

      if (!membership) {
        throw fastify.httpErrors.forbidden(
          'You must be a member of the group to create channels',
        );
      }

      // Check if channel name already exists in this group
      const { data: existingChannels } = await fastify.supabaseAdmin
        .from('channels')
        .select('id')
        .eq('group_id', groupId)
        .eq('name', name.trim());

      if (existingChannels && existingChannels.length > 0) {
        throw fastify.httpErrors.badRequest(
          'A channel with this name already exists in the group',
        );
      }

      // Create the channel
      const { data: channel, error } = await fastify.supabaseAdmin
        .from('channels')
        .insert({
          name: name.trim(),
          group_id: groupId,
          description: description?.trim() || '',
          is_default: false,
        })
        .select()
        .single();

      if (error) {
        fastify.log.error(error);
        throw fastify.httpErrors.internalServerError(
          'Failed to create channel',
        );
      }

      reply.code(201);
      return {
        id: channel.id,
        name: channel.name,
        group: channel.group_id,
        description: channel.description || '',
        is_default: channel.is_default,
        created_at: channel.created_at,
        updated_at: channel.updated_at,
      };
    },
  );

  /**
   * GET /api/channels/:channelId/messages
   * Get cursor-paginated message history for a channel (infinite scroll)
   */
  fastify.get<{
    Params: { channelId: string };
    Querystring: { cursor?: string; limit?: number };
  }>(
    '/:channelId/messages',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            channelId: { type: 'string' },
          },
          required: ['channelId'],
        },
        querystring: {
          type: 'object',
          properties: {
            cursor: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    content: { type: 'string' },
                    channel: { type: 'string' },
                    sender: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        username: { type: 'string' },
                        avatar: { type: 'string' },
                      },
                    },
                    type: { type: 'string', enum: ['text', 'system', 'giphy'] },
                    gif_url: { type: 'string' },
                    created_at: { type: 'string' },
                    updated_at: { type: 'string' },
                    reactions: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          emoji: { type: 'string' },
                          count: { type: 'integer' },
                          userIds: { type: 'array', items: { type: 'string' } },
                        },
                      },
                    },
                  },
                },
              },
              nextCursor: { type: ['string', 'null'] },
              hasMore: { type: 'boolean' },
            },
          },
          403: { $ref: 'error#' },
          404: { $ref: 'error#' },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { channelId: string };
        Querystring: { cursor?: string; limit?: number };
      }>,
    ) => {
      const { channelId } = request.params;
      const { cursor } = request.query;
      const limit = request.query.limit || 50;

      // Get the channel and verify membership
      const { data: channel, error: channelError } = await fastify.supabaseAdmin
        .from('channels')
        .select('group_id')
        .eq('id', channelId)
        .single();

      if (channelError) {
        if (channelError.code === 'PGRST116') {
          throw fastify.httpErrors.notFound('Channel not found');
        }
        fastify.log.error(channelError);
        throw fastify.httpErrors.internalServerError('Failed to fetch channel');
      }

      // Verify user is a member of the group
      const { data: membership } = await fastify.supabaseAdmin
        .from('group_members')
        .select('user_id')
        .eq('group_id', channel.group_id)
        .eq('user_id', requireUser(request).id)
        .single();

      if (!membership) {
        throw fastify.httpErrors.forbidden('Not a member of this group');
      }

      // Build cursor-based query
      // When cursor is present: fetch messages older than cursor
      // When no cursor: fetch most recent messages
      let query = fastify.supabaseAdmin
        .from('messages')
        .select('*')
        .eq('channel_id', channelId);

      if (cursor) {
        // Fetch messages older than cursor timestamp
        query = query.lt('created_at', cursor);
      }

      // Always order by created_at descending (newest first from query perspective)
      // Then we'll reverse to get chronological order
      // Fetch limit+1 to determine whether there are more pages
      const { data: messages, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit + 1);

      if (error) {
        fastify.log.error(error);
        throw fastify.httpErrors.internalServerError(
          'Failed to fetch messages',
        );
      }

      // Determine hasMore before slicing
      const hasMore = messages.length > limit;
      const trimmedMessages = messages.slice(0, limit);

      // Reverse to chronological order (oldest first)
      const orderedMessages = trimmedMessages.reverse();

      // Get unique sender IDs and fetch profiles
      const senderIds = [
        ...new Set(orderedMessages.map((msg) => msg.sender_id).filter(Boolean)),
      ] as string[];

      let senderProfiles: Record<
        string,
        { id: string; username: string; avatar: string | null }
      > = {};

      if (senderIds.length > 0) {
        const { data: profiles, error: profilesError } =
          await fastify.supabaseAdmin
            .from('profiles')
            .select('id, username, name, avatar')
            .in('id', senderIds);

        if (profilesError) {
          fastify.log.error(profilesError);
        } else if (profiles) {
          senderProfiles = Object.fromEntries(profiles.map((p) => [p.id, p]));
        }
      }

      // nextCursor = created_at of the oldest message (first in orderedMessages)
      const nextCursor =
        orderedMessages.length > 0 ? orderedMessages[0].created_at : null;

      // Batch-fetch all reactions for these messages
      const messageIds = orderedMessages.map((msg) => msg.id);
      const reactionsMap: Record<string, ReactionSummary[]> = {};

      if (messageIds.length > 0) {
        const { data: allReactions, error: reactionsError } =
          await fastify.supabaseAdmin
            .from('message_reactions')
            .select('message_id, user_id, emoji')
            .in('message_id', messageIds);

        if (reactionsError) {
          fastify.log.error(reactionsError);
        } else if (allReactions) {
          // Group by message_id then by emoji → ReactionSummary[]
          for (const row of allReactions) {
            if (!reactionsMap[row.message_id]) {
              reactionsMap[row.message_id] = [];
            }
            const existing = reactionsMap[row.message_id].find(
              (r) => r.emoji === row.emoji,
            );
            if (existing) {
              existing.count++;
              existing.userIds.push(row.user_id);
            } else {
              reactionsMap[row.message_id].push({
                emoji: row.emoji,
                count: 1,
                userIds: [row.user_id],
              });
            }
          }
        }
      }

      return {
        items: orderedMessages.map((msg) => {
          const profile = msg.sender_id ? senderProfiles[msg.sender_id] : null;
          return {
            id: msg.id,
            content: msg.content,
            channel: msg.channel_id || '',
            sender: {
              id: msg.sender_id || '',
              username: profile?.username || 'Unknown',
              avatar: profile?.avatar || '',
            },
            type: msg.type as 'text' | 'system' | 'giphy',
            gif_url: msg.gif_url ?? undefined,
            created_at: msg.created_at,
            updated_at: msg.updated_at,
            reactions: reactionsMap[msg.id] ?? [],
          };
        }),
        nextCursor,
        hasMore,
      };
    },
  );

  /**
   * DELETE /api/channels/:channelId
   * Delete a channel (cannot delete default channels)
   */
  fastify.delete<{ Params: { channelId: string } }>(
    '/:channelId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            channelId: { type: 'string' },
          },
          required: ['channelId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
          400: { $ref: 'error#' },
          403: { $ref: 'error#' },
          404: { $ref: 'error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { channelId: string } }>) => {
      const { channelId } = request.params;

      // Get the channel
      const { data: channel, error: channelError } = await fastify.supabaseAdmin
        .from('channels')
        .select('*')
        .eq('id', channelId)
        .single();

      if (channelError) {
        if (channelError.code === 'PGRST116') {
          throw fastify.httpErrors.notFound('Channel not found');
        }
        fastify.log.error(channelError);
        throw fastify.httpErrors.internalServerError('Failed to fetch channel');
      }

      // Cannot delete default channels
      if (channel.is_default) {
        throw fastify.httpErrors.badRequest(
          'Cannot delete the default channel',
        );
      }

      // Verify user is a member of the group
      const { data: membership } = await fastify.supabaseAdmin
        .from('group_members')
        .select('user_id')
        .eq('group_id', channel.group_id)
        .eq('user_id', requireUser(request).id)
        .single();

      if (!membership) {
        throw fastify.httpErrors.forbidden('Not a member of this group');
      }

      // Delete the channel
      const { error: deleteError } = await fastify.supabaseAdmin
        .from('channels')
        .delete()
        .eq('id', channelId);

      if (deleteError) {
        fastify.log.error(deleteError);
        throw fastify.httpErrors.internalServerError(
          'Failed to delete channel',
        );
      }

      return { success: true };
    },
  );
}
