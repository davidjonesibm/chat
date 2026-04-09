import { jwtVerify, errors } from 'jose';

export interface JwtUserPayload {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
}

/**
 * Verify a Supabase-issued JWT locally using the project's JWT secret.
 * Returns a user-like object with id, email, and user_metadata extracted from the token payload.
 * Throws descriptive errors for expired or invalid tokens.
 */
export async function verifySupabaseJwt(
  token: string,
  jwtSecret: string,
): Promise<JwtUserPayload> {
  const secret = new TextEncoder().encode(jwtSecret);

  try {
    const { payload } = await jwtVerify(token, secret, {
      // Supabase tokens use the "authenticated" audience
      audience: 'authenticated',
    });

    const sub = payload.sub;
    if (!sub) {
      throw new Error('JWT payload missing sub claim');
    }

    return {
      id: sub,
      email: (payload.email as string) ?? '',
      user_metadata: (payload.user_metadata as Record<string, unknown>) ?? {},
    };
  } catch (err) {
    if (err instanceof errors.JWTExpired) {
      throw new Error('Token has expired');
    }
    if (err instanceof errors.JWTClaimValidationFailed) {
      throw new Error(`Token claim validation failed: ${err.claim}`);
    }
    if (err instanceof errors.JWSSignatureVerificationFailed) {
      throw new Error('Token signature verification failed');
    }
    // Re-throw our own errors (e.g. missing sub)
    if (err instanceof Error && !err.message.startsWith('Token')) {
      throw new Error(`Invalid token: ${err.message}`);
    }
    throw err;
  }
}
