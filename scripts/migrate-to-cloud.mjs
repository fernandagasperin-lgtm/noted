// Envia o conteudo de data/workspace.json para o banco na nuvem.
// Uso:  node --env-file=.env.local scripts/migrate-to-cloud.mjs
//
// Roda quantas vezes quiser: cada item e inserido por id, e reexecutar
// so atualiza o que ja existe em vez de duplicar.

import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. Ponha em .env.local e rode com --env-file=.env.local');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function sql(strings, ...values) {
  const text = strings.reduce(
    (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ''),
    '',
  );
  const res = await pool.query(text, values);
  return res.rows;
}

const ws = JSON.parse(await readFile(new URL('../data/workspace.json', import.meta.url), 'utf8'));

await sql`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT '📁',
    color TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
await sql`
  CREATE TABLE IF NOT EXISTS assistants (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT '✦', prompt TEXT NOT NULL DEFAULT '',
    title_pattern TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
await sql`
  CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL, type TEXT NOT NULL, icon TEXT NOT NULL,
    elements JSONB NOT NULL DEFAULT '[]'::jsonb, body TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;

for (const p of ws.projects ?? []) {
  await sql`
    INSERT INTO projects (id, name, icon, color, created_at)
    VALUES (${p.id}, ${p.name}, ${p.icon}, ${p.color}, ${p.createdAt})
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, icon = EXCLUDED.icon, color = EXCLUDED.color`;
}

for (const a of ws.assistants ?? []) {
  await sql`
    INSERT INTO assistants (id, project_id, name, icon, prompt, title_pattern, created_at)
    VALUES (${a.id}, ${a.projectId}, ${a.name}, ${a.icon}, ${a.prompt},
            ${a.titlePattern}, ${a.createdAt})
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, icon = EXCLUDED.icon,
          prompt = EXCLUDED.prompt, title_pattern = EXCLUDED.title_pattern`;
}

let localImages = 0;
for (const page of ws.pages ?? []) {
  for (const el of page.elements ?? []) {
    if (el.type === 'image' && typeof el.src === 'string' && el.src.startsWith('/uploads/')) {
      localImages++;
    }
  }
  await sql`
    INSERT INTO pages (id, project_id, title, type, icon, elements, body, created_at, updated_at)
    VALUES (${page.id}, ${page.projectId}, ${page.title}, ${page.type}, ${page.icon},
            ${JSON.stringify(page.elements ?? [])}::jsonb, ${page.body ?? ''},
            ${page.createdAt}, ${page.updatedAt})
    ON CONFLICT (id) DO UPDATE
      SET title = EXCLUDED.title, type = EXCLUDED.type, icon = EXCLUDED.icon,
          elements = EXCLUDED.elements, body = EXCLUDED.body,
          project_id = EXCLUDED.project_id, updated_at = EXCLUDED.updated_at`;
}

console.log(
  `Migrado: ${ws.projects?.length ?? 0} projeto(s), ` +
    `${ws.assistants?.length ?? 0} assistente(s), ${ws.pages?.length ?? 0} pagina(s).`,
);

await pool.end();

if (localImages > 0) {
  console.warn(
    `\nAtencao: ${localImages} imagem(ns) ainda apontam para /uploads/ (disco local) e ` +
      `nao vao carregar na nuvem. Suba elas de novo pelo app depois do deploy.`,
  );
}
