import type { FastifyInstance } from 'fastify';

// Fastify JSON schemas for response serialization
// These control which fields are exposed in API responses
// Source of truth for field SHAPES is the PB-derived types in @chat/shared

export const errorSchema = {
  $id: 'error',
  type: 'object' as const,
  properties: {
    statusCode: { type: 'integer' as const },
    error: { type: 'string' as const },
    message: { type: 'string' as const },
  },
};

export const userSchema = {
  $id: 'user',
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    email: { type: 'string' as const },
    username: { type: 'string' as const },
    avatar: { type: 'string' as const },
    created_at: { type: 'string' as const },
    updated_at: { type: 'string' as const },
  },
};

export const groupSchema = {
  $id: 'group',
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    name: { type: 'string' as const },
    description: { type: 'string' as const },
    owner: { type: 'string' as const },
    members: { type: 'array' as const, items: { type: 'string' as const } },
    created_at: { type: 'string' as const },
    updated_at: { type: 'string' as const },
  },
};

export const channelSchema = {
  $id: 'channel',
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    name: { type: 'string' as const },
    group: { type: 'string' as const },
    description: { type: 'string' as const },
    is_default: { type: 'boolean' as const },
    created_at: { type: 'string' as const },
    updated_at: { type: 'string' as const },
  },
};

export const messageSchema = {
  $id: 'message',
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    content: { type: 'string' as const },
    channel: { type: 'string' as const },
    sender: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' as const },
        username: { type: 'string' as const },
        avatar: { type: 'string' as const },
      },
    },
    type: { type: 'string' as const },
    created_at: { type: 'string' as const },
    updated_at: { type: 'string' as const },
  },
};

export function registerSharedSchemas(fastify: FastifyInstance) {
  fastify.addSchema(errorSchema);
  fastify.addSchema(userSchema);
  fastify.addSchema(groupSchema);
  fastify.addSchema(channelSchema);
  fastify.addSchema(messageSchema);
}
