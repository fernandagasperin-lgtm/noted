import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/access';
import { createProject } from '@/lib/store';

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });
  const body = await req.json();
  return NextResponse.json(await createProject(me.id, body.name ?? 'Novo projeto'), {
    status: 201,
  });
}
