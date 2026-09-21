import { NextResponse } from 'next/server';
import { updateAssistant, deleteAssistant } from '@/lib/store';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const assistant = await updateAssistant(id, await req.json());
  if (!assistant) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(assistant);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ok = await deleteAssistant(id);
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
