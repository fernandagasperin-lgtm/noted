import { NextResponse } from 'next/server';
import { canEditPage, currentUser } from '@/lib/access';
import { createRow } from '@/lib/store';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });

  const { id } = await params;
  if (!(await canEditPage(me.id, id))) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  return NextResponse.json(await createRow(id, body.title ?? ''), { status: 201 });
}
