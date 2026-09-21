import { NextResponse } from 'next/server';
import { readWorkspace, createPage } from '@/lib/store';

export async function GET() {
  return NextResponse.json(await readWorkspace());
}

export async function POST(req: Request) {
  const body = await req.json();
  const page = await createPage(body.projectId, body.title ?? 'Sem titulo', body.type ?? 'canvas');
  if (!page) return NextResponse.json({ error: 'projeto inexistente' }, { status: 400 });
  return NextResponse.json(page, { status: 201 });
}
