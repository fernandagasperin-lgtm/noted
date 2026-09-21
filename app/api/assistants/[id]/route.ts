import { NextResponse } from 'next/server';
import { currentUser, ownsProject } from '@/lib/access';
import { deleteAssistant, getAssistantProject, updateAssistant } from '@/lib/store';

type Ctx = { params: Promise<{ id: string }> };

async function mayManage(userId: string, assistantId: string): Promise<boolean> {
  const projectId = await getAssistantProject(assistantId);
  return projectId ? ownsProject(userId, projectId) : false;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });

  const { id } = await params;
  if (!(await mayManage(me.id, id))) {
    return NextResponse.json(
      { error: 'Só o dono do projeto pode editar assistentes.' },
      { status: 403 },
    );
  }
  const assistant = await updateAssistant(id, await req.json());
  if (!assistant) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(assistant);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });

  const { id } = await params;
  if (!(await mayManage(me.id, id))) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 });
  }
  const ok = await deleteAssistant(id);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'not found' }, { status: 404 });
}
