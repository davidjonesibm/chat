import type { JwtClaims } from '@chat/shared';

/**
 * Simple JWT decoder - decodes JWT without verification
 * We trust the token from PocketBase (it signed it)
 */
export function decodeJwt(token: string): JwtClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Decode the payload (second part)
    const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(payload) as JwtClaims;
  } catch {
    return null;
  }
}
