import { NextResponse } from 'next/server';
import { currentUser, ownsProject } from '@/lib/access';
import { createPage, readWorkspace } from '@/lib/store';

export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });
  return NextResponse.json(await readWorkspace(me));
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });

  const body = await req.json();
  // Ver uma pagina compartilhada dentro de um projeto nao da direito de criar
  // paginas nele: elas nasceriam invisiveis para o dono do projeto.
  if (!(await ownsProject(me.id, body.projectId))) {
    return NextResponse.json(
      { error: 'So o dono do projeto pode criar paginas nele.' },
      { status: 403 },
    );
  }

  const page = await createPage(me.id, body.projectId, body.title ?? 'Sem titulo', body.type ?? 'canvas');
  if (!page) return NextResponse.json({ error: 'projeto inexistente' }, { status: 400 });
  return NextResponse.json(page, { status: 201 });
}
