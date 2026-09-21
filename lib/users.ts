import { randomUUID } from 'crypto';
import { ensureSchema, sql } from './db';
import { hashPassword, newToken, verifyPassword } from './password';

export interface User {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  createdAt: string;
}

export type InviteKind = 'invite' | 'reset';

export interface Invite {
  token: string;
  kind: InviteKind;
  email: string | null;
  userName: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

const INVITE_TTL_DAYS = 14;

type Row = Record<string, unknown>;

function toUser(r: Row): User {
  return {
    id: r.id as string,
    email: r.email as string,
    name: r.name as string,
    isAdmin: Boolean(r.is_admin),
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function countUsers(): Promise<number> {
  await ensureSchema();
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM users`;
  return count as number;
}

export async function listUsers(): Promise<User[]> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM users ORDER BY created_at`;
  return rows.map(toUser);
}

export async function getUser(id: string): Promise<User | null> {
  await ensureSchema();
  const [row] = await sql`SELECT * FROM users WHERE id = ${id}`;
  return row ? toUser(row) : null;
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  await ensureSchema();
  const [row] = await sql`SELECT * FROM users WHERE email = ${normalizeEmail(email)}`;
  if (!row) return null;
  const ok = await verifyPassword(password, row.password_hash as string);
  return ok ? toUser(row) : null;
}

/**
 * The very first account becomes the admin and adopts anything that predates
 * accounts, so an existing workspace does not end up ownerless and invisible.
 */
export async function createUser(
  email: string,
  name: string,
  password: string,
): Promise<User> {
  await ensureSchema();
  const isFirst = (await countUsers()) === 0;
  const id = randomUUID();

  const [row] = await sql`
    INSERT INTO users (id, email, name, password_hash, is_admin)
    VALUES (${id}, ${normalizeEmail(email)}, ${name}, ${await hashPassword(password)}, ${isFirst})
    RETURNING *`;

  if (isFirst) {
    await sql`UPDATE projects SET owner_id = ${id} WHERE owner_id IS NULL`;
    await sql`UPDATE pages SET owner_id = ${id} WHERE owner_id IS NULL`;
  }
  return toUser(row);
}

export async function emailTaken(email: string): Promise<boolean> {
  await ensureSchema();
  const [row] = await sql`SELECT id FROM users WHERE email = ${normalizeEmail(email)}`;
  return Boolean(row);
}

export async function setPassword(userId: string, password: string): Promise<void> {
  await ensureSchema();
  await sql`UPDATE users SET password_hash = ${await hashPassword(password)} WHERE id = ${userId}`;
}

export async function deleteUser(id: string, transferTo: string): Promise<boolean> {
  await ensureSchema();
  // Keep the work: pages and projects move to whoever removed the account.
  await sql`UPDATE projects SET owner_id = ${transferTo} WHERE owner_id = ${id}`;
  await sql`UPDATE pages SET owner_id = ${transferTo} WHERE owner_id = ${id}`;
  const [gone] = await sql`DELETE FROM users WHERE id = ${id} RETURNING id`;
  return Boolean(gone);
}

export async function createInvite(
  kind: InviteKind,
  createdBy: string | null,
  options: { email?: string; userId?: string } = {},
): Promise<Invite> {
  await ensureSchema();
  const token = newToken();
  const expires = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO invites (token, kind, email, user_id, created_by, expires_at)
    VALUES (${token}, ${kind}, ${options.email ? normalizeEmail(options.email) : null},
            ${options.userId ?? null}, ${createdBy}, ${expires.toISOString()})`;
  return {
    token,
    kind,
    email: options.email ? normalizeEmail(options.email) : null,
    userName: null,
    expiresAt: expires.toISOString(),
    usedAt: null,
    createdAt: new Date().toISOString(),
  };
}

export async function listInvites(): Promise<Invite[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT i.*, u.name AS user_name
      FROM invites i
      LEFT JOIN users u ON u.id = i.user_id
     WHERE i.used_at IS NULL AND i.expires_at > now()
     ORDER BY i.created_at DESC`;
  return rows.map((r) => ({
    token: r.token as string,
    kind: r.kind as InviteKind,
    email: (r.email as string) ?? null,
    userName: (r.user_name as string) ?? null,
    expiresAt: new Date(r.expires_at as string).toISOString(),
    usedAt: null,
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}

export async function readInvite(token: string): Promise<
  { kind: InviteKind; email: string | null; userId: string | null } | null
> {
  await ensureSchema();
  const [row] = await sql`
    SELECT * FROM invites
     WHERE token = ${token} AND used_at IS NULL AND expires_at > now()`;
  if (!row) return null;
  return {
    kind: row.kind as InviteKind,
    email: (row.email as string) ?? null,
    userId: (row.user_id as string) ?? null,
  };
}

export async function consumeInvite(token: string): Promise<boolean> {
  await ensureSchema();
  const [row] = await sql`
    UPDATE invites SET used_at = now()
     WHERE token = ${token} AND used_at IS NULL AND expires_at > now()
    RETURNING token`;
  return Boolean(row);
}

export async function revokeInvite(token: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM invites WHERE token = ${token}`;
}
