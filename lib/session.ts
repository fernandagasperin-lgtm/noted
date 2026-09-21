// Edge-safe: only jose, no node:crypto. The middleware runs this.
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'quadro_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function secret(): Uint8Array {
  const value = process.env.APP_SECRET;
  if (!value) throw new Error('APP_SECRET nao configurada.');
  return new TextEncoder().encode(value);
}

export function sessionConfigured(): boolean {
  return Boolean(process.env.APP_SECRET);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

/** Returns the user id, or null when the token is missing, tampered or expired. */
export async function readSession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
