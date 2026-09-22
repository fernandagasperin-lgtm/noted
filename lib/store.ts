import { randomUUID } from 'crypto';
import { ensureSchema, iso, sql } from './db';
import {
  DEFAULT_TITLE_PATTERN,
  PROJECT_COLORS,
  type Assistant,
  type BoardElement,
  type DbColumn,
  type DbRow,
  type Me,
  type Page,
  type PageRole,
  type Project,
  type Workspace,
} from './types';

const PAGE_ICONS: Record<Page['type'], string> = {
  canvas: '🎨',
  text: '📄',
  table: '▤',
  assistants: '✦',
  database: '▦',
};

type Row = Record<string, unknown>;

function toProject(r: Row, userId: string): Project {
  return {
    id: r.id as string,
    name: r.name as string,
    icon: r.icon as string,
    color: r.color as string,
    ownerId: (r.owner_id as string) ?? null,
    mine: r.owner_id === userId,
    createdAt: iso(r.created_at),
  };
}

function toAssistant(r: Row): Assistant {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    name: r.name as string,
    icon: r.icon as string,
    prompt: r.prompt as string,
    titlePattern: r.title_pattern as string,
    createdAt: iso(r.created_at),
  };
}

function toPage(r: Row): Page {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    ownerId: (r.owner_id as string) ?? null,
    role: (r.role as PageRole) ?? 'viewer',
    title: r.title as string,
    type: r.type as Page['type'],
    icon: r.icon as string,
    elements: (r.elements ?? []) as BoardElement[],
    body: r.body as string,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

/** Only what this user owns or has been given access to. */
export async function readWorkspace(me: Me): Promise<Workspace> {
  await ensureSchema();

  const pages = await sql`
    SELECT p.*,
           CASE WHEN p.owner_id = ${me.id} THEN 'owner' ELSE s.role END AS role
      FROM pages p
      LEFT JOIN page_shares s ON s.page_id = p.id AND s.user_id = ${me.id}
     WHERE p.owner_id = ${me.id} OR s.user_id IS NOT NULL
     ORDER BY p.created_at`;

  const projects = await sql`
    SELECT * FROM projects p
     WHERE p.owner_id = ${me.id}
        OR EXISTS (
             SELECT 1 FROM pages pg
              WHERE pg.project_id = p.id
                AND (pg.owner_id = ${me.id}
                     OR EXISTS (SELECT 1 FROM page_shares s
                                 WHERE s.page_id = pg.id AND s.user_id = ${me.id}))
           )
     ORDER BY p.created_at`;

  const visibleProjectIds = projects.map((p) => p.id as string);
  const assistants = visibleProjectIds.length
    ? await sql`
        SELECT * FROM assistants
         WHERE project_id = ANY(${visibleProjectIds})
         ORDER BY created_at`
    : [];

  if (projects.length === 0) {
    // createProject ja cria o quadro inicial; criar outro aqui duplicava a pagina.
    const project = await createProject(me.id, 'Meu primeiro projeto');
    const created = await sql`
      SELECT * FROM pages WHERE project_id = ${project.id} ORDER BY created_at`;
    return {
      me,
      projects: [project],
      assistants: [],
      pages: created.map((r) => toPage({ ...r, role: 'owner' })),
    };
  }

  return {
    me,
    projects: projects.map((p) => toProject(p, me.id)),
    assistants: assistants.map(toAssistant),
    pages: pages.map(toPage),
  };
}

export async function createProject(ownerId: string, name: string): Promise<Project> {
  await ensureSchema();
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM projects`;
  const color = PROJECT_COLORS[(count as number) % PROJECT_COLORS.length];
  const [row] = await sql`
    INSERT INTO projects (id, name, icon, color, owner_id)
    VALUES (${randomUUID()}, ${name}, '📁', ${color}, ${ownerId})
    RETURNING *`;
  const project = toProject(row, ownerId);
  await createPage(ownerId, project.id, 'Quadro inicial', 'canvas');
  return project;
}

export async function updateProject(
  id: string,
  patch: Partial<Project>,
  userId: string,
): Promise<Project | null> {
  await ensureSchema();
  const [row] = await sql`
    UPDATE projects
       SET name = COALESCE(${patch.name ?? null}, name),
           icon = COALESCE(${patch.icon ?? null}, icon),
           color = COALESCE(${patch.color ?? null}, color)
     WHERE id = ${id}
    RETURNING *`;
  return row ? toProject(row, userId) : null;
}

export async function deleteProject(id: string, ownerId: string): Promise<boolean> {
  await ensureSchema();
  const removed = await sql`SELECT id FROM pages WHERE project_id = ${id}`;
  // pages, shares and assistants go with it via ON DELETE CASCADE
  const [gone] = await sql`DELETE FROM projects WHERE id = ${id} RETURNING id`;
  if (!gone) return false;

  await dropDanglingRefs(removed.map((r) => r.id as string));

  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM projects WHERE owner_id = ${ownerId}`;
  if ((count as number) === 0) await createProject(ownerId, 'Meu primeiro projeto');
  return true;
}

export async function createPage(
  ownerId: string,
  projectId: string,
  title: string,
  type: Page['type'],
): Promise<Page | null> {
  await ensureSchema();
  const [project] = await sql`SELECT id FROM projects WHERE id = ${projectId}`;
  if (!project) return null;
  const [row] = await sql`
    INSERT INTO pages (id, project_id, title, type, icon, owner_id)
    VALUES (${randomUUID()}, ${projectId}, ${title}, ${type}, ${PAGE_ICONS[type]}, ${ownerId})
    RETURNING *`;
  return toPage({ ...row, role: 'owner' });
}

export async function updatePage(
  id: string,
  patch: Partial<Page>,
  role: PageRole,
): Promise<Page | null> {
  await ensureSchema();
  const [row] = await sql`
    UPDATE pages
       SET title = COALESCE(${patch.title ?? null}, title),
           icon = COALESCE(${patch.icon ?? null}, icon),
           project_id = COALESCE(${patch.projectId ?? null}, project_id),
           body = COALESCE(${patch.body ?? null}, body),
           elements = COALESCE(${patch.elements ? JSON.stringify(patch.elements) : null}::jsonb, elements),
           updated_at = now()
     WHERE id = ${id}
    RETURNING *`;
  return row ? toPage({ ...row, role }) : null;
}

export async function deletePage(id: string, ownerId: string): Promise<boolean> {
  await ensureSchema();
  const [page] = await sql`SELECT project_id FROM pages WHERE id = ${id}`;
  if (!page) return false;

  await sql`DELETE FROM pages WHERE id = ${id}`;
  await dropDanglingRefs([id]);

  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM pages WHERE project_id = ${page.project_id}`;
  if ((count as number) === 0) {
    await createPage(ownerId, page.project_id as string, 'Quadro inicial', 'canvas');
  }
  return true;
}

export async function createAssistant(
  projectId: string,
  patch: Partial<Assistant>,
): Promise<Assistant | null> {
  await ensureSchema();
  const [project] = await sql`SELECT id FROM projects WHERE id = ${projectId}`;
  if (!project) return null;
  const [row] = await sql`
    INSERT INTO assistants (id, project_id, name, icon, prompt, title_pattern)
    VALUES (
      ${randomUUID()}, ${projectId},
      ${patch.name ?? 'Novo assistente'}, ${patch.icon ?? '✦'},
      ${patch.prompt ?? ''}, ${patch.titlePattern ?? DEFAULT_TITLE_PATTERN}
    )
    RETURNING *`;
  return toAssistant(row);
}

export async function updateAssistant(
  id: string,
  patch: Partial<Assistant>,
): Promise<Assistant | null> {
  await ensureSchema();
  const [row] = await sql`
    UPDATE assistants
       SET name = COALESCE(${patch.name ?? null}, name),
           icon = COALESCE(${patch.icon ?? null}, icon),
           prompt = COALESCE(${patch.prompt ?? null}, prompt),
           title_pattern = COALESCE(${patch.titlePattern ?? null}, title_pattern)
     WHERE id = ${id}
    RETURNING *`;
  return row ? toAssistant(row) : null;
}

export async function deleteAssistant(id: string): Promise<boolean> {
  await ensureSchema();
  const [gone] = await sql`DELETE FROM assistants WHERE id = ${id} RETURNING id`;
  if (!gone) return false;
  // cards that ran this assistant lose their source card but keep their results
  await sql`
    UPDATE pages
       SET elements = (
             SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
               FROM jsonb_array_elements(elements) AS e
              WHERE NOT (e->>'type' = 'assistant' AND e->>'assistantId' = ${id})
           )
     WHERE elements @> ${JSON.stringify([{ type: 'assistant', assistantId: id }])}::jsonb`;
  return true;
}

export async function getAssistantProject(id: string): Promise<string | null> {
  await ensureSchema();
  const [row] = await sql`SELECT project_id FROM assistants WHERE id = ${id}`;
  return row ? (row.project_id as string) : null;
}

export async function getPageProject(id: string): Promise<string | null> {
  await ensureSchema();
  const [row] = await sql`SELECT project_id FROM pages WHERE id = ${id}`;
  return row ? (row.project_id as string) : null;
}

/** Link blocks pointing at pages that no longer exist would render as broken cards. */
async function dropDanglingRefs(removedPageIds: string[]) {
  for (const pageId of removedPageIds) {
    await sql`
      UPDATE pages
         SET elements = (
               SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
                 FROM jsonb_array_elements(elements) AS e
                WHERE NOT (e->>'type' = 'reference' AND e->>'refPageId' = ${pageId})
             )
       WHERE elements @> ${JSON.stringify([{ type: 'reference', refPageId: pageId }])}::jsonb`;
  }
}

// ---------- tabelas (paginas do tipo database) ----------

function toColumn(r: Row): DbColumn {
  return {
    id: r.id as string,
    pageId: r.page_id as string,
    name: r.name as string,
    type: r.type as DbColumn['type'],
    options: (r.options ?? []) as DbColumn['options'],
    format: (r.format ?? 'plain') as DbColumn['format'],
    position: Number(r.position),
  };
}

function toRow(r: Row): DbRow {
  return {
    id: r.id as string,
    pageId: r.page_id as string,
    title: r.title as string,
    values: (r.cells ?? {}) as Record<string, unknown>,
    body: r.body as string,
    position: Number(r.position),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

/** Nasce vazia, com a coluna de titulo e nada mais, como no Notion: quem cria
 *  decide as colunas em vez de apagar as que vieram sem ter pedido. */
export async function readTable(
  pageId: string,
): Promise<{ columns: DbColumn[]; rows: DbRow[] }> {
  await ensureSchema();
  const columns = await sql`
    SELECT * FROM db_columns WHERE page_id = ${pageId} ORDER BY position, created_at`;
  const rows = await sql`
    SELECT * FROM db_rows WHERE page_id = ${pageId} ORDER BY position, created_at`;
  return { columns: columns.map(toColumn), rows: rows.map(toRow) };
}

export async function createColumn(
  pageId: string,
  name: string,
  type: DbColumn['type'],
): Promise<DbColumn> {
  await ensureSchema();
  const [{ next }] = await sql`
    SELECT COALESCE(MAX(position) + 1, 0)::int AS next FROM db_columns WHERE page_id = ${pageId}`;
  const [row] = await sql`
    INSERT INTO db_columns (id, page_id, name, type, position)
    VALUES (${randomUUID()}, ${pageId}, ${name}, ${type}, ${next as number})
    RETURNING *`;
  return toColumn(row);
}

export async function updateColumn(
  id: string,
  patch: Partial<DbColumn>,
): Promise<DbColumn | null> {
  await ensureSchema();
  const [row] = await sql`
    UPDATE db_columns
       SET name = COALESCE(${patch.name ?? null}, name),
           type = COALESCE(${patch.type ?? null}, type),
           format = COALESCE(${patch.format ?? null}, format),
           options = COALESCE(${patch.options ? JSON.stringify(patch.options) : null}::jsonb, options),
           position = COALESCE(${patch.position ?? null}, position)
     WHERE id = ${id}
    RETURNING *`;
  return row ? toColumn(row) : null;
}

export async function deleteColumn(id: string): Promise<boolean> {
  await ensureSchema();
  const [gone] = await sql`DELETE FROM db_columns WHERE id = ${id} RETURNING page_id`;
  if (!gone) return false;
  // os valores daquela coluna deixam de ter sentido nas linhas
  await sql`
    UPDATE db_rows SET cells = cells - ${id}
     WHERE page_id = ${gone.page_id as string} AND cells ? ${id}`;
  return true;
}

export async function createRow(pageId: string, title = ''): Promise<DbRow> {
  await ensureSchema();
  const [{ next }] = await sql`
    SELECT COALESCE(MAX(position) + 1, 0)::int AS next FROM db_rows WHERE page_id = ${pageId}`;
  const [row] = await sql`
    INSERT INTO db_rows (id, page_id, title, position)
    VALUES (${randomUUID()}, ${pageId}, ${title}, ${next as number})
    RETURNING *`;
  return toRow(row);
}

export async function updateRow(id: string, patch: Partial<DbRow>): Promise<DbRow | null> {
  await ensureSchema();
  const [row] = await sql`
    UPDATE db_rows
       SET title = COALESCE(${patch.title ?? null}, title),
           body = COALESCE(${patch.body ?? null}, body),
           cells = COALESCE(${patch.values ? JSON.stringify(patch.values) : null}::jsonb, cells),
           position = COALESCE(${patch.position ?? null}, position),
           updated_at = now()
     WHERE id = ${id}
    RETURNING *`;
  return row ? toRow(row) : null;
}

export async function deleteRow(id: string): Promise<boolean> {
  await ensureSchema();
  const [gone] = await sql`DELETE FROM db_rows WHERE id = ${id} RETURNING id`;
  return Boolean(gone);
}

export async function getColumnPage(id: string): Promise<string | null> {
  await ensureSchema();
  const [row] = await sql`SELECT page_id FROM db_columns WHERE id = ${id}`;
  return row ? (row.page_id as string) : null;
}

export async function getRowPage(id: string): Promise<string | null> {
  await ensureSchema();
  const [row] = await sql`SELECT page_id FROM db_rows WHERE id = ${id}`;
  return row ? (row.page_id as string) : null;
}
