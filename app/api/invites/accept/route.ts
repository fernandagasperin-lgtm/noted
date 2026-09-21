import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from '@/lib/session';
import { consumeInvite, createUser, emailTaken, readInvite, setPassword } from '@/lib/users';

/** Reads an invite so the screen can show what it is for, without consuming it. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  const invite = await readInvite(token);
  if (!invite) return NextResponse.json({ error: 'Convite invalido ou expirado.' }, { status: 404 });
  return NextResponse.json({ kind: invite.kind, email: invite.email });
}

export async function POST(req: Request) {
  const { token, name, password } = await req.json();

  const invite = await readInvite(token);
  if (!invite) {
    return NextResponse.json({ error: 'Convite invalido ou expirado.' }, { status: 404 });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'A senha precisa ter ao menos 8 caracteres.' }, { status: 400 });
  }

  let userId: string;

  if (invite.kind === 'reset') {
    if (!invite.userId) {
      return NextResponse.json({ error: 'Convite invalido.' }, { status: 400 });
    }
    await setPassword(invite.userId, password);
    userId = invite.userId;
  } else {
    if (!invite.email) {
      return NextResponse.json({ error: 'Convite invalido.' }, { status: 400 });
    }
    if (await emailTaken(invite.email)) {
      return NextResponse.json({ error: 'Ja existe uma conta com esse e-mail.' }, { status: 409 });
    }
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 });
    }
    const user = await createUser(invite.email, name.trim(), password);
    userId = user.id;
  }

  // Consumed only after the account work succeeded, so a failure leaves the link usable.
  await consumeInvite(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
