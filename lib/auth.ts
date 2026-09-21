import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'quadro_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret(): Uint8Array {
  const value = process.env.APP_SECRET;
  if (!value) throw new Error('APP_SECRET nao configurada.');
  return new TextEncoder().encode(value);
}

export function authConfigured(): boolean {
  return Boolean(process.env.APP_PASSWORD && process.env.APP_SECRET);
}

/** Constant-time compare so a wrong guess cannot be narrowed down by timing. */
export function passwordMatches(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD ?? '';
  if (candidate.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ ok: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
