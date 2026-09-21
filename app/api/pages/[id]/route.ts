import { NextResponse } from 'next/server';
import { canSeeProject, currentUser, pageRole } from '@/lib/access';
import { deletePage, updatePage } from '@/lib/store';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });

  const { id } = await params;
  const role = await pageRole(me.id, id);
  if (!role) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (role === 'viewer') {
    return NextResponse.json({ error: 'Voce so tem acesso de leitura.' }, { status: 403 });
  }

  const patch = await req.json();

  // Renaming and moving belong to the owner; an editor changes the content only.
  if (role !== 'owner') {
    delete patch.projectId;
    delete patch.title;
    delete patch.icon;
  } else if (patch.projectId && !(await canSeeProject(me.id, patch.projectId))) {
    return NextResponse.json({ error: 'sem permissao no projeto destino' }, { status: 403 });
  }

  const page = await updatePage(id, patch, role);
  if (!page) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(page);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });

  const { id } = await params;
  if ((await pageRole(me.id, id)) !== 'owner') {
    return NextResponse.json({ error: 'Só o dono pode excluir a pagina.' }, { status: 403 });
  }
  const ok = await deletePage(id, me.id);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'not found' }, { status: 404 });
}
