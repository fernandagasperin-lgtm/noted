import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/access';
import { createInvite, emailTaken, listInvites } from '@/lib/users';

export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });
  if (!me.isAdmin) return NextResponse.json({ error: 'sem permissao' }, { status: 403 });
  return NextResponse.json({ invites: await listInvites() });
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });
  if (!me.isAdmin) return NextResponse.json({ error: 'sem permissao' }, { status: 403 });

  const { email, kind, userId } = await req.json();

  if (kind === 'reset') {
    if (!userId) return NextResponse.json({ error: 'userId obrigatorio' }, { status: 400 });
    return NextResponse.json(await createInvite('reset', me.id, { userId }), { status: 201 });
  }

  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'E-mail invalido.' }, { status: 400 });
  }
  if (await emailTaken(email)) {
    return NextResponse.json({ error: 'Ja existe uma conta com esse e-mail.' }, { status: 409 });
  }
  return NextResponse.json(await createInvite('invite', me.id, { email }), { status: 201 });
}
