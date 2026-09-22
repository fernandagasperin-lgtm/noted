import { NextResponse } from 'next/server';
import { canEditPage, currentUser } from '@/lib/access';
import { deleteColumn, getColumnPage, updateColumn } from '@/lib/store';

type Ctx = { params: Promise<{ columnId: string }> };

/** A coluna so pode ser tocada por quem pode editar a pagina onde ela vive. */
async function autorizado(columnId: string): Promise<boolean> {
  const me = await currentUser();
  if (!me) return false;
  const pageId = await getColumnPage(columnId);
  return pageId ? canEditPage(me.id, pageId) : false;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { columnId } = await params;
  if (!(await autorizado(columnId))) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 });
  }
  const column = await updateColumn(columnId, await req.json());
  if (!column) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(column);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { columnId } = await params;
  if (!(await autorizado(columnId))) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 });
  }
  const ok = await deleteColumn(columnId);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'not found' }, { status: 404 });
}
