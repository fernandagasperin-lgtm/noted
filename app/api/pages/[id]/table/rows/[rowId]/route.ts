import { NextResponse } from 'next/server';
import { canEditPage, currentUser } from '@/lib/access';
import { deleteRow, getRowPage, updateRow } from '@/lib/store';

type Ctx = { params: Promise<{ rowId: string }> };

async function autorizado(rowId: string): Promise<boolean> {
  const me = await currentUser();
  if (!me) return false;
  const pageId = await getRowPage(rowId);
  return pageId ? canEditPage(me.id, pageId) : false;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { rowId } = await params;
  if (!(await autorizado(rowId))) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 });
  }
  const row = await updateRow(rowId, await req.json());
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { rowId } = await params;
  if (!(await autorizado(rowId))) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 });
  }
  const ok = await deleteRow(rowId);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'not found' }, { status: 404 });
}
