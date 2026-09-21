import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from '@/lib/session';
import { countUsers, createUser } from '@/lib/users';

function codeMatches(candidate: string): boolean {
  const expected = process.env.SETUP_CODE ?? '';
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Cria a conta de administrador. So funciona enquanto o workspace nao tem
 * nenhuma conta E quem chama sabe o SETUP_CODE — sem isso, qualquer pessoa que
 * achasse o endereco logo apos o deploy poderia tomar o workspace.
 */
export async function POST(req: Request) {
  const expected = process.env.SETUP_CODE;
  if (!expected) {
    return NextResponse.json(
      { error: 'Defina SETUP_CODE nas variaveis de ambiente para criar a primeira conta.' },
      { status: 503 },
    );
  }
  const { email, name, password, code } = await req.json();

  // O codigo e conferido antes de consultar o banco: quem nao sabe o codigo
  // nao provoca nenhum trabalho no servidor.
  if (typeof code !== 'string' || !codeMatches(code)) {
    return NextResponse.json({ error: 'Codigo de instalacao incorreto.' }, { status: 403 });
  }
  if ((await countUsers()) > 0) {
    return NextResponse.json({ error: 'O workspace ja tem uma conta.' }, { status: 409 });
  }
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
