import { FastifyInstance, FastifyRequest } from 'fastify';
import type { MessageSearchRequest, MessageWithSender } from '@chat/shared';

function requireUser(request: FastifyRequest) {
  if (!request.user)
    throw new Error('Unauthenticated request reached route handler');
  return request.user;
}

/**
 * Search routes (all protected)
 * - GET /messages - Full-text search across messages in a group
 */
export default async function (fastify: FastifyInstance) {
  // Protect ALL search routes with authentication
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * GET /api/search/messages?query=foo&groupId=xxx&channelId=yyy&limit=50&cursor=zzz
   * Full-text search across messages in a group (or single channel)
   */
  fastify.get<{ Querystring: MessageSearchRequest }>(
    '/messages',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            query: { type: 'string', minLength: 1, maxLength: 200 },
            groupId: { type: 'string' },
            channelId: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            cursor: { type: 'string' },
          },
          required: ['query', 'groupId'],
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
                    type: {
                      type: 'string',
                      enum: ['text', 'system', 'giphy', 'image'],
                    },
                    gif_url: { type: 'string' },
                    image_url: { type: 'string' },
                    seq: { type: 'integer' },
                    created_at: { type: 'string' },
                    updated_at: { type: 'string' },
                  },
                },
              },
              nextCursor: { type: ['string', 'null'] },
              hasMore: { type: 'boolean' },
            },
          },
          400: { $ref: 'error#' },
          403: { $ref: 'error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: MessageSearchRequest }>) => {
      const { query, groupId, channelId, cursor } = request.query;
      const limit = request.query.limit || 50;
      const userId = requireUser(request).id;

      // Verify user is a member of the group
      const { data: membership } = await fastify.supabaseAdmin
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .single();

      if (!membership) {
        throw fastify.httpErrors.forbidden('Not a member of this group');
      }

      // If channelId provided, verify it belongs to the group
      if (channelId) {
        const { data: channel, error: channelError } =
          await fastify.supabaseAdmin
            .from('channels')
            .select('id')
            .eq('id', channelId)
            .eq('group_id', groupId)
            .single();

        if (channelError || !channel) {
          throw fastify.httpErrors.badRequest(
            'Channel not found in this group',
          );
        }
      }

      // Get channels in the group to scope search
      let channelIds: string[];

      if (channelId) {
        channelIds = [channelId];
      } else {
        const { data: channels, error: channelsError } =
          await fastify.supabaseAdmin
            .from('channels')
            .select('id')
            .eq('group_id', groupId);

        if (channelsError) {
          fastify.log.error(channelsError);
          throw fastify.httpErrors.internalServerError(
            'Failed to fetch channels',
          );
        }

        channelIds = (channels || []).map((ch) => ch.id);
      }

      if (channelIds.length === 0) {
        return { items: [], nextCursor: null, hasMore: false };
      }

      // Build the search query
      let dbQuery = fastify.supabaseAdmin
        .from('messages')
        .select('*')
        .in('channel_id', channelIds);

      // Search strategy: full-text search for queries >= 3 chars, ILIKE for short queries
      if (query.length >= 3) {
        dbQuery = dbQuery.textSearch('search_vector', query, {
          type: 'plain',
          config: 'english',
        });
      } else {
        // Short query: use ILIKE for prefix/substring matching
        const escaped = query.replace(/[%_]/g, '\\$&');
        dbQuery = dbQuery.ilike('content', `%${escaped}%`);
      }

      // Cursor-based pagination: fetch messages older than cursor
      if (cursor) {
        dbQuery = dbQuery.lt('created_at', cursor);
      }

      // Order by created_at descending and fetch limit+1 for hasMore check
      const { data: messages, error } = await dbQuery
        .order('created_at', { ascending: false })
        .limit(limit + 1);

      if (error) {
        fastify.log.error(error);
        throw fastify.httpErrors.internalServerError(
          'Failed to search messages',
        );
      }

      // Determine hasMore before slicing
      const hasMore = messages.length > limit;
      const trimmedMessages = messages.slice(0, limit);

      // Get unique sender IDs and fetch profiles
      const senderIds = [
        ...new Set(trimmedMessages.map((msg) => msg.sender_id).filter(Boolean)),
      ] as string[];

      let senderProfiles: Record<
        string,
        { id: string; username: string | null; avatar: string | null }
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

      // nextCursor = created_at of the last (oldest) message in this page
      const nextCursor =
        trimmedMessages.length > 0
          ? trimmedMessages[trimmedMessages.length - 1].created_at
          : null;

      const items: MessageWithSender[] = trimmedMessages.map((msg) => {
        const profile = msg.sender_id ? senderProfiles[msg.sender_id] : null;
        return {
          id: msg.id,
          content: msg.content,
          channel: msg.channel_id,
          sender: {
            id: msg.sender_id || '',
            username: profile?.username || 'Unknown',
            avatar: profile?.avatar || '',
          },
          type: msg.type as 'text' | 'system' | 'giphy' | 'image',
          gif_url: msg.gif_url ?? undefined,
          image_url: msg.image_url ?? undefined,
          seq: msg.seq,
          created_at: msg.created_at,
          updated_at: msg.updated_at,
        };
      });

      return {
        items,
        nextCursor,
        hasMore,
      };
    },
  );
}
