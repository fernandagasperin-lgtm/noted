import { NextResponse } from 'next/server';
import { createAssistant } from '@/lib/store';

export async function POST(req: Request) {
  const body = await req.json();
  const assistant = await createAssistant(body.projectId, body);
  if (!assistant) return NextResponse.json({ error: 'projeto inexistente' }, { status: 400 });
  return NextResponse.json(assistant, { status: 201 });
}
