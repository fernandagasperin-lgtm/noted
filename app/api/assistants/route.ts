import { NextResponse } from 'next/server';
import { currentUser, ownsProject } from '@/lib/access';
import { createAssistant } from '@/lib/store';

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });

  const body = await req.json();
  if (!(await ownsProject(me.id, body.projectId))) {
    return NextResponse.json(
      { error: 'Só o dono do projeto pode criar assistentes.' },
      { status: 403 },
    );
  }
  const assistant = await createAssistant(body.projectId, body);
  if (!assistant) return NextResponse.json({ error: 'projeto inexistente' }, { status: 400 });
  return NextResponse.json(assistant, { status: 201 });
}
