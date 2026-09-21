import { NextResponse } from 'next/server';
import { currentUser, ownsProject } from '@/lib/access';
import { deleteProject, updateProject } from '@/lib/store';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });

  const { id } = await params;
  if (!(await ownsProject(me.id, id))) {
    return NextResponse.json({ error: 'Só o dono pode editar o projeto.' }, { status: 403 });
  }
  const project = await updateProject(id, await req.json(), me.id);
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(project);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });

  const { id } = await params;
  if (!(await ownsProject(me.id, id))) {
    return NextResponse.json({ error: 'Só o dono pode excluir o projeto.' }, { status: 403 });
  }
  const ok = await deleteProject(id, me.id);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'not found' }, { status: 404 });
}
