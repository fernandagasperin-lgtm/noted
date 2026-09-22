import { NextResponse } from 'next/server';
import { canViewPage, currentUser } from '@/lib/access';
import { setFavorite } from '@/lib/store';

/** Favoritar e por pessoa: cada uma tem a propria lista da mesma pagina. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });

  const { id } = await params;
  if (!(await canViewPage(me.id, id))) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const { favorite } = await req.json();
  await setFavorite(me.id, id, Boolean(favorite));
  return NextResponse.json({ ok: true });
}
