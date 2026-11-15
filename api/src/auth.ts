import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Db } from "./db.js";

export const COOKIE = "backlog_session";
const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
export const checkPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export async function createSession(db: Db, userId: number) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [
    hashToken(token),
    userId,
    expires,
  ]);
  return { token, expires };
}

export async function userFromToken(db: Db, token: string | undefined) {
  if (!token) return null;
  const { rows } = await db.query(
    `SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > $2`,
    [hashToken(token), new Date()]
  );
  return (rows[0] as { id: number; email: string }) ?? null;
}

export async function destroySession(db: Db, token: string | undefined) {
  if (token) await db.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}
