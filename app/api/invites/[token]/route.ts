import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/access';
import { revokeInvite } from '@/lib/users';

export async function DELETE(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });
  if (!me.isAdmin) return NextResponse.json({ error: 'sem permissao' }, { status: 403 });
  await revokeInvite((await params).token);
  return NextResponse.json({ ok: true });
}
