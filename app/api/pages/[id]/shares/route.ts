import { NextResponse } from 'next/server';
import { currentUser, listShares, ownsPage, removeShare, setShare } from '@/lib/access';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });

  const { id } = await params;
  if (!(await ownsPage(me.id, id))) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 });
  }
  return NextResponse.json({ shares: await listShares(id) });
}

export async function PUT(req: Request, { params }: Ctx) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });

  const { id } = await params;
  if (!(await ownsPage(me.id, id))) {
    return NextResponse.json({ error: 'Só o dono pode compartilhar.' }, { status: 403 });
  }

  const { userId, role } = await req.json();
  if (userId === me.id) {
    return NextResponse.json({ error: 'Voce ja e o dono desta pagina.' }, { status: 400 });
  }
  if (role !== 'editor' && role !== 'viewer') {
    return NextResponse.json({ error: 'papel invalido' }, { status: 400 });
  }

  await setShare(id, userId, role);
  return NextResponse.json({ shares: await listShares(id) });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });

  const { id } = await params;
  if (!(await ownsPage(me.id, id))) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 });
  }
  const { userId } = await req.json();
  await removeShare(id, userId);
  return NextResponse.json({ shares: await listShares(id) });
}
