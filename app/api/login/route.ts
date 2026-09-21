import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  authConfigured,
  createSessionToken,
  passwordMatches,
} from '@/lib/auth';

export async function POST(req: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ error: 'login nao configurado' }, { status: 503 });
  }

  const { password } = await req.json();
  if (typeof password !== 'string' || !passwordMatches(password)) {
    return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
