import { NextResponse } from 'next/server';
import { canEditPage, currentUser } from '@/lib/access';
import { createColumn } from '@/lib/store';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });

  const { id } = await params;
  if (!(await canEditPage(me.id, id))) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 });
  }

  const body = await req.json();
  return NextResponse.json(
    await createColumn(id, body.name ?? 'Nova coluna', body.type ?? 'text'),
    { status: 201 },
  );
}
