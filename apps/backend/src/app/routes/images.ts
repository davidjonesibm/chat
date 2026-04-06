import { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';

function requireUser(request: FastifyRequest) {
  if (!request.user)
    throw new Error('Unauthenticated request reached route handler');
  return request.user;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export default async function (fastify: FastifyInstance) {
  fastify.post(
    '/',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = requireUser(request);

      const file = await request.file();
      if (!file) {
        throw fastify.httpErrors.badRequest('No file uploaded');
      }

      // Extract channelId from multipart fields
      const channelIdField = file.fields['channelId'];
      if (
        !channelIdField ||
        Array.isArray(channelIdField) ||
        channelIdField.type !== 'field' ||
        typeof channelIdField.value !== 'string' ||
        !channelIdField.value
      ) {
        throw fastify.httpErrors.badRequest('channelId is required');
      }
      const channelId = channelIdField.value as string;

      // Validate MIME type
      if (
        !ALLOWED_MIME_TYPES.includes(
          file.mimetype as (typeof ALLOWED_MIME_TYPES)[number],
        )
      ) {
        throw fastify.httpErrors.badRequest(
          'Invalid image type. Allowed: JPEG, PNG, WebP',
        );
      }

      // Look up channel to get group_id
      const { data: channel } = await fastify.supabaseAdmin
        .from('channels')
        .select('group_id')
        .eq('id', channelId)
        .single();

      if (!channel) {
        throw fastify.httpErrors.notFound('Channel not found');
      }

      // Verify user is a member of the channel's group
      const { data: membership } = await fastify.supabaseAdmin
        .from('group_members')
        .select('user_id')
        .eq('group_id', channel.group_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        throw fastify.httpErrors.forbidden('Not a member of this group');
      }

      // Consume the file stream into a buffer
      const buffer = await file.toBuffer();

      const ext = MIME_TO_EXT[file.mimetype];
      const storagePath = `${user.id}/${channelId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await fastify.supabaseAdmin.storage
        .from('chat-images')
        .upload(storagePath, buffer, {
          contentType: file.mimetype,
        });

      if (uploadError) {
        fastify.log.error(uploadError, 'Image upload failed');
        throw fastify.httpErrors.internalServerError('Failed to upload image');
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = fastify.supabaseAdmin.storage
        .from('chat-images')
        .getPublicUrl(storagePath);

      reply.code(201);
      return { url: publicUrl };
    },
  );
}
