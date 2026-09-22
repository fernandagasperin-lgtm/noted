import { NextResponse } from 'next/server';
import { canViewPage, currentUser } from '@/lib/access';
import { readTable } from '@/lib/store';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });

  const { id } = await params;
  if (!(await canViewPage(me.id, id))) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json(await readTable(id));
}
