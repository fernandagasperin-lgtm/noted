import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { currentUser } from '@/lib/access';

const BUCKET = 'uploads';

const ALLOWED: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

/** The service role key stays server-side; it never reaches the browser. */
function storage() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } }).storage.from(BUCKET);
}

export async function POST(req: Request) {
  if (!(await currentUser())) {
    return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });
  }

  const bucket = storage();
  if (!bucket) {
    return NextResponse.json(
      { error: 'Envio de imagem nao configurado (falta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 501 },
    );
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing file' }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'unsupported type' }, { status: 415 });
  }

  const path = `${randomUUID()}${ext}`;
  const { error } = await bucket.upload(path, file, { contentType: file.type });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ src: bucket.getPublicUrl(path).data.publicUrl }, { status: 201 });
}
