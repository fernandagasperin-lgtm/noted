import { Pool } from 'pg';

interface QueryRunner {
  query(text: string, values: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

let pool: Pool | null = null;
let testRunner: QueryRunner | null = null;

/** Lets the test suite point the same queries at an in-process Postgres.
 *  Refused in production so it can never become a backdoor. */
export function useTestDatabase(runner: QueryRunner | null): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('useTestDatabase nao pode ser chamado em producao.');
  }
  testRunner = runner;
  ready = null;
}

/** Resolved on first query, not at import time, so builds and the login page
 *  work without a database configured. */
function getRunner(): QueryRunner {
  if (testRunner) return testRunner;
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL nao configurada. Copie a connection string do painel do Supabase para o .env.local (ou para as variaveis de ambiente da hospedagem).',
      );
    }
    // Postgres gerenciado exige TLS e serve um certificado cuja raiz o container
    // nao conhece; um banco local nao fala TLS nenhum.
    const isLocal = /(@|\/\/)(localhost|127\.0\.0\.1)(:|\/)/.test(connectionString);
    pool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 8,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

/**
 * Tagged template that turns `sql\`... ${value} ...\`` into a parameterised query,
 * so interpolated values are always bound, never concatenated into the SQL.
 */
export async function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<Record<string, unknown>[]> {
  const text = strings.reduce(
    (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ''),
    '',
  );
  const result = await getRunner().query(text, values);
  return result.rows;
}

/** Postgres hands back Date objects; the app speaks ISO strings. */
export function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

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

    await sql`
      CREATE TABLE IF NOT EXISTS db_columns (
        id         TEXT PRIMARY KEY,
        page_id    TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        type       TEXT NOT NULL,
        options    JSONB NOT NULL DEFAULT '[]'::jsonb,
        format     TEXT NOT NULL DEFAULT 'plain',
        position   INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;

    // Uma linha por registro, e nao a tabela inteira num bloco so: assim duas
    // pessoas editando linhas diferentes nao sobrescrevem uma a outra.
    await sql`
      CREATE TABLE IF NOT EXISTS db_rows (
        id         TEXT PRIMARY KEY,
        page_id    TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        title      TEXT NOT NULL DEFAULT '',
        cells      JSONB NOT NULL DEFAULT '{}'::jsonb,
        body       TEXT NOT NULL DEFAULT '',
        position   INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;

    await sql`ALTER TABLE db_columns ADD COLUMN IF NOT EXISTS width INT NOT NULL DEFAULT 180`;
    await sql`ALTER TABLE db_columns ADD COLUMN IF NOT EXISTS decimals INT`;
    await sql`ALTER TABLE db_columns ADD COLUMN IF NOT EXISTS display TEXT NOT NULL DEFAULT 'number'`;
    // a coluna de titulo nao vive em db_columns, entao a largura dela fica na pagina
    await sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS title_width INT NOT NULL DEFAULT 320`;
    await sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS table_sorts JSONB NOT NULL DEFAULT '[]'::jsonb`;
    await sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS table_filters JSONB NOT NULL DEFAULT '[]'::jsonb`;
    await sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS group_by TEXT`;

    await sql`
      CREATE TABLE IF NOT EXISTS page_favorites (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, page_id)
      )`;

    await sql`CREATE INDEX IF NOT EXISTS db_columns_page_idx ON db_columns(page_id)`;
    await sql`CREATE INDEX IF NOT EXISTS db_rows_page_idx ON db_rows(page_id)`;
    await sql`CREATE INDEX IF NOT EXISTS pages_project_idx ON pages(project_id)`;
    await sql`CREATE INDEX IF NOT EXISTS pages_owner_idx ON pages(owner_id)`;
    await sql`CREATE INDEX IF NOT EXISTS assistants_project_idx ON assistants(project_id)`;
    await sql`CREATE INDEX IF NOT EXISTS page_shares_user_idx ON page_shares(user_id)`;
  })();
  return ready;
}
