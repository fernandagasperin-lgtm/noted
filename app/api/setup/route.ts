import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from '@/lib/session';
import { countUsers, createUser } from '@/lib/users';

/** Only usable while the workspace has no accounts at all. */
export async function POST(req: Request) {
  if ((await countUsers()) > 0) {
    return NextResponse.json({ error: 'O workspace ja tem uma conta.' }, { status: 409 });
  }

  const { email, name, password } = await req.json();
  if (!email?.trim() || !name?.trim() || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json(
      { error: 'Informe nome, e-mail e uma senha de pelo menos 8 caracteres.' },
      { status: 400 },
    );
  }

  const user = await createUser(email, name.trim(), password);
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
