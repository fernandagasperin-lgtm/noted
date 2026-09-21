import { NextResponse } from 'next/server';
import { updateProject, deleteProject } from '@/lib/store';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const project = await updateProject(id, await req.json());
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(project);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ok = await deleteProject(id);
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
