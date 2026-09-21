import { NextResponse } from 'next/server';
import { updatePage, deletePage } from '@/lib/store';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const patch = await req.json();
  const page = await updatePage(id, patch);
  if (!page) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(page);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ok = await deletePage(id);
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
