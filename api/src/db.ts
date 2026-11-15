import pg from "pg";

export type Db = Pick<pg.Pool, "query">;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  platform TEXT,
  status TEXT NOT NULL DEFAULT 'to_play',
  rating INTEGER,
  hours_played INTEGER NOT NULL DEFAULT 0,
  cover_url TEXT,
  notes TEXT,
  finished_at TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
`;

export async function migrate(db: Db) {
  for (const statement of SCHEMA.split(";")) {
    if (statement.trim()) await db.query(statement);
  }
}

export function createPool(connectionString: string) {
  const ssl = connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false };
  return new pg.Pool({ connectionString, ssl });
}
