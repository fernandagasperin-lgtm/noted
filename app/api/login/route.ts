import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from '@/lib/session';
import { authenticate } from '@/lib/users';

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
  }

  const user = await authenticate(email, password);
  if (!user) {
    // Same message either way, so it does not reveal which e-mails exist.
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(user.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
