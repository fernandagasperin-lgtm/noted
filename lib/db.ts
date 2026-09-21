import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let client: NeonQueryFunction<false, false> | null = null;

/** Resolved on first query, not at import time, so builds and the login page
 *  work without a database configured. */
function db(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'DATABASE_URL nao configurada. Na Vercel ela vem do banco Neon; localmente, ponha em .env.local.',
      );
    }
    client = neon(url);
  }
  return client;
}

export const sql: NeonQueryFunction<false, false> = ((
  strings: TemplateStringsArray,
  ...values: unknown[]
) => db()(strings, ...values)) as NeonQueryFunction<false, false>;

let ready: Promise<void> | null = null;

/** Creates the tables on first use, so a deploy needs no separate migration step. */
export function ensureSchema(): Promise<void> {
  ready ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE,
        name          TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        is_admin      BOOLEAN NOT NULL DEFAULT false,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;

    await sql`
      CREATE TABLE IF NOT EXISTS invites (
        token      TEXT PRIMARY KEY,
        kind       TEXT NOT NULL,
        email      TEXT,
        user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at    TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;

    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        icon       TEXT NOT NULL DEFAULT '📁',
        color      TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES users(id) ON DELETE SET NULL`;

    await sql`
      CREATE TABLE IF NOT EXISTS assistants (
        id            TEXT PRIMARY KEY,
        project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name          TEXT NOT NULL,
        icon          TEXT NOT NULL DEFAULT '✦',
        prompt        TEXT NOT NULL DEFAULT '',
        title_pattern TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;

    await sql`
      CREATE TABLE IF NOT EXISTS pages (
        id         TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title      TEXT NOT NULL,
        type       TEXT NOT NULL,
        icon       TEXT NOT NULL,
        elements   JSONB NOT NULL DEFAULT '[]'::jsonb,
        body       TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES users(id) ON DELETE SET NULL`;

    await sql`
      CREATE TABLE IF NOT EXISTS page_shares (
        page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role    TEXT NOT NULL,
        PRIMARY KEY (page_id, user_id)
      )`;

    await sql`
      CREATE TABLE IF NOT EXISTS page_presence (
        page_id  TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (page_id, user_id)
      )`;

    await sql`CREATE INDEX IF NOT EXISTS pages_project_idx ON pages(project_id)`;
    await sql`CREATE INDEX IF NOT EXISTS pages_owner_idx ON pages(owner_id)`;
    await sql`CREATE INDEX IF NOT EXISTS assistants_project_idx ON assistants(project_id)`;
    await sql`CREATE INDEX IF NOT EXISTS page_shares_user_idx ON page_shares(user_id)`;
  })();
  return ready;
}
