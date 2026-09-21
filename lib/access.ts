import { cookies } from 'next/headers';
import { ensureSchema, sql } from './db';
import { SESSION_COOKIE, readSession } from './session';
import { getUser, type User } from './users';

export type PageRole = 'owner' | 'editor' | 'viewer';

export async function currentUser(): Promise<User | null> {
  const store = await cookies();
  const userId = await readSession(store.get(SESSION_COOKIE)?.value);
  return userId ? getUser(userId) : null;
}

/** Null when the page does not exist or the user cannot reach it at all. */
export async function pageRole(userId: string, pageId: string): Promise<PageRole | null> {
  await ensureSchema();
  const [row] = await sql`
    SELECT p.owner_id, s.role
      FROM pages p
      LEFT JOIN page_shares s ON s.page_id = p.id AND s.user_id = ${userId}
     WHERE p.id = ${pageId}`;
  if (!row) return null;
  if (row.owner_id === userId) return 'owner';
  const role = row.role as PageRole | null;
  return role ?? null;
}

export async function canViewPage(userId: string, pageId: string): Promise<boolean> {
  return (await pageRole(userId, pageId)) !== null;
}

export async function canEditPage(userId: string, pageId: string): Promise<boolean> {
  const role = await pageRole(userId, pageId);
  return role === 'owner' || role === 'editor';
}

export async function ownsPage(userId: string, pageId: string): Promise<boolean> {
  return (await pageRole(userId, pageId)) === 'owner';
}

export async function ownsProject(userId: string, projectId: string): Promise<boolean> {
  await ensureSchema();
  const [row] = await sql`SELECT owner_id FROM projects WHERE id = ${projectId}`;
  return Boolean(row) && row.owner_id === userId;
}

/** A project is reachable when you own it or can see at least one page in it. */
export async function canSeeProject(userId: string, projectId: string): Promise<boolean> {
  await ensureSchema();
  const [row] = await sql`
    SELECT 1 AS ok
      FROM projects p
     WHERE p.id = ${projectId}
       AND (
         p.owner_id = ${userId}
         OR EXISTS (
           SELECT 1 FROM pages pg
            WHERE pg.project_id = p.id
              AND (pg.owner_id = ${userId}
                   OR EXISTS (SELECT 1 FROM page_shares s
                               WHERE s.page_id = pg.id AND s.user_id = ${userId}))
         )
       )`;
  return Boolean(row);
}

export interface ShareEntry {
  userId: string;
  name: string;
  email: string;
  role: 'editor' | 'viewer';
}

export async function listShares(pageId: string): Promise<ShareEntry[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT s.user_id, s.role, u.name, u.email
      FROM page_shares s
      JOIN users u ON u.id = s.user_id
     WHERE s.page_id = ${pageId}
     ORDER BY u.name`;
  return rows.map((r) => ({
    userId: r.user_id as string,
    name: r.name as string,
    email: r.email as string,
    role: r.role as 'editor' | 'viewer',
  }));
}

export async function setShare(
  pageId: string,
  userId: string,
  role: 'editor' | 'viewer',
): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO page_shares (page_id, user_id, role)
    VALUES (${pageId}, ${userId}, ${role})
    ON CONFLICT (page_id, user_id) DO UPDATE SET role = EXCLUDED.role`;
}

export async function removeShare(pageId: string, userId: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM page_shares WHERE page_id = ${pageId} AND user_id = ${userId}`;
}

const PRESENCE_WINDOW_SECONDS = 45;

export async function touchPresence(pageId: string, userId: string): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO page_presence (page_id, user_id, seen_at)
    VALUES (${pageId}, ${userId}, now())
    ON CONFLICT (page_id, user_id) DO UPDATE SET seen_at = now()`;
}

export async function othersOnPage(pageId: string, userId: string): Promise<string[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT u.name
      FROM page_presence pp
      JOIN users u ON u.id = pp.user_id
     WHERE pp.page_id = ${pageId}
       AND pp.user_id <> ${userId}
       AND pp.seen_at > now() - (${PRESENCE_WINDOW_SECONDS} || ' seconds')::interval`;
  return rows.map((r) => r.name as string);
}
