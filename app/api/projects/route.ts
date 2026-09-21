import { NextResponse } from 'next/server';
import { createProject } from '@/lib/store';

export async function POST(req: Request) {
  const body = await req.json();
  const project = await createProject(body.name ?? 'Novo projeto');
  return NextResponse.json(project, { status: 201 });
}
