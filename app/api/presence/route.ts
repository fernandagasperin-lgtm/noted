import { NextResponse } from 'next/server';
import { canViewPage, currentUser, othersOnPage, touchPresence } from '@/lib/access';

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });

  const { pageId } = await req.json();
  if (!(await canViewPage(me.id, pageId))) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 });
  }

  await touchPresence(pageId, me.id);
  return NextResponse.json({ others: await othersOnPage(pageId, me.id) });
}
