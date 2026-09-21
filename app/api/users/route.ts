import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/access';
import { deleteUser, listUsers } from '@/lib/users';

/** Everyone signed in can list people, so the share picker has names to offer. */
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });
  const users = await listUsers();
  return NextResponse.json({
    users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin })),
  });
}

export async function DELETE(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });
  if (!me.isAdmin) return NextResponse.json({ error: 'sem permissao' }, { status: 403 });

  const { userId } = await req.json();
  if (userId === me.id) {
    return NextResponse.json({ error: 'Voce nao pode remover a propria conta.' }, { status: 400 });
  }
  const ok = await deleteUser(userId, me.id);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'not found' }, { status: 404 });
}
