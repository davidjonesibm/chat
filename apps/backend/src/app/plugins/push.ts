import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import webpush from 'web-push';

declare module 'fastify' {
  interface FastifyInstance {
    webpush: typeof webpush;
    vapidConfigured: boolean;
  }
}

const pushPlugin: FastifyPluginAsync = async (fastify) => {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

  if (!vapidPublicKey || !vapidPrivateKey) {
    fastify.log.warn(
      'VAPID keys not configured. Push notifications will be unavailable. ' +
        'Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.',
    );
    fastify.decorate('webpush', webpush);
    fastify.decorate('vapidConfigured', false);
    return;
  }

  // Trim keys defensively — trailing newlines/spaces in .env cause VAPID mismatch
  const publicKey = vapidPublicKey.trim();
  const privateKey = vapidPrivateKey.trim();

  // Warn if VAPID_SUBJECT uses a non-public host — Apple APNs will reject with BadJwtToken.
  // Covers: https://localhost, https://127.0.0.1, and mailto:user@*.local
  try {
    const parsed = new URL(vapidSubject);
    if (parsed.protocol === 'mailto:') {
      // mailto: URIs have no hostname; extract domain from the pathname (user@domain)
      const emailDomain = parsed.pathname.split('@').at(-1) ?? '';
      if (emailDomain === 'localhost' || emailDomain.endsWith('.local')) {
        fastify.log.warn(
          `VAPID_SUBJECT mailto address uses a non-public domain ('${emailDomain}'). Apple Web Push (APNs) will reject all push notifications with BadJwtToken. Set VAPID_SUBJECT to a real mailto: address or a public https:// URL.`,
        );
      }
    } else if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      if (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname.endsWith('.local')
      ) {
        fastify.log.warn(
          `VAPID_SUBJECT is set to a non-public URL ('${vapidSubject}'). Apple Web Push (APNs) will reject all push notifications with BadJwtToken. Set VAPID_SUBJECT to a public https:// URL or mailto: address.`,
        );
      }
    }
  } catch {
    // URL parse failed — skip silently, web-push will validate upstream
  }

  // Configure VAPID details for web-push
  webpush.setVapidDetails(vapidSubject, publicKey, privateKey);

  fastify.log.info(
    {
      vapidPublicKeyPrefix: publicKey.slice(0, 10),
      vapidPublicKeyLength: publicKey.length,
    },
    'VAPID configured — verify this prefix matches what GET /api/push/vapid-public-key serves',
  );

  // Decorate Fastify instance
  fastify.decorate('webpush', webpush);
  fastify.decorate('vapidConfigured', true);
};

export default fp(pushPlugin, {
  name: 'push-plugin',
  dependencies: ['supabase-plugin'],
});
