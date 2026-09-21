import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';

const ALLOWED: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing file' }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'unsupported type' }, { status: 415 });
  }

  const blob = await put(`uploads/${randomUUID()}${ext}`, file, {
    access: 'public',
    contentType: file.type,
  });

  return NextResponse.json({ src: blob.url }, { status: 201 });
}
