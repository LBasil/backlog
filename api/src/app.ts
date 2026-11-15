import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import type { Db } from "./db.js";
import { COOKIE, checkPassword, createSession, destroySession, hashPassword, userFromToken } from "./auth.js";
import { credentialsSchema, gameCreateSchema, gameUpdateSchema, listQuerySchema } from "./schemas.js";

type User = { id: number; email: string };
declare module "fastify" {
  interface FastifyRequest {
    user: User | null;
  }
}

const GAME_COLUMNS = `id, title, platform, status, rating, hours_played AS "hoursPlayed",
  cover_url AS "coverUrl", notes, finished_at AS "finishedAt"`;

export interface AppOptions {
  db: Db;
  corsOrigin?: string;
  secureCookie?: boolean;
}

export function buildApp({ db, corsOrigin, secureCookie = false }: AppOptions) {
  const app = Fastify({ logger: false });
  app.register(cookie);
  if (corsOrigin) app.register(cors, { origin: corsOrigin, credentials: true });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: "Données invalides", details: err.issues.map(i => ({ path: i.path.join("."), message: i.message })) });
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) console.error(err);
    reply.status(status).send({ error: status >= 500 ? "Erreur serveur" : (err as Error).message });
  });

  app.decorateRequest("user", null);
  app.addHook("preHandler", async req => {
    req.user = await userFromToken(db, req.cookies[COOKIE]);
  });

  const requireUser = (req: { user: User | null }, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => {
    if (!req.user) {
      reply.status(401).send({ error: "Connexion requise" });
      return null;
    }
    return req.user;
  };

  const setSessionCookie = (reply: any, token: string, expires: Date) =>
    reply.setCookie(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: secureCookie, path: "/", expires });

  app.get("/health", async () => ({ ok: true }));

  // ---- Auth ----
  app.post("/auth/register", async (req, reply) => {
    const { email, password } = credentialsSchema.parse(req.body);
    const exists = await db.query("SELECT 1 FROM users WHERE email = $1", [email]);
    if (exists.rows.length) return reply.status(409).send({ error: "Cet email est déjà utilisé" });
    const { rows } = await db.query("INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email", [
      email,
      await hashPassword(password),
    ]);
    const user = rows[0] as User;
    const { token, expires } = await createSession(db, user.id);
    setSessionCookie(reply, token, expires);
    return reply.status(201).send({ user });
  });

  app.post("/auth/login", async (req, reply) => {
    const { email, password } = credentialsSchema.parse(req.body);
    const { rows } = await db.query("SELECT id, email, password_hash FROM users WHERE email = $1", [email]);
    const row = rows[0] as (User & { password_hash: string }) | undefined;
    // Même message dans les deux cas pour ne pas révéler quels emails existent.
    if (!row || !(await checkPassword(password, row.password_hash))) {
      return reply.status(401).send({ error: "Email ou mot de passe incorrect" });
    }
    const { token, expires } = await createSession(db, row.id);
    setSessionCookie(reply, token, expires);
    return { user: { id: row.id, email: row.email } };
  });

  app.post("/auth/logout", async (req, reply) => {
    await destroySession(db, req.cookies[COOKIE]);
    reply.clearCookie(COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/auth/me", async (req, reply) => {
    const user = requireUser(req, reply);
    return user ? { user } : reply;
  });

  // ---- Games ----
  app.get("/games", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return reply;
    const { status, q, page, pageSize } = listQuerySchema.parse(req.query);
    const where = ["user_id = $1"];
    const params: unknown[] = [user.id];
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where.push(`lower(title) LIKE $${params.length}`);
    }
    const clause = where.join(" AND ");
    const total = Number((await db.query(`SELECT count(*) AS n FROM games WHERE ${clause}`, params)).rows[0].n);
    const { rows } = await db.query(
      `SELECT ${GAME_COLUMNS} FROM games WHERE ${clause} ORDER BY created_at DESC, id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      params
    );
    return { items: rows, total, page, pageSize };
  });

  app.get("/games/:id", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return reply;
    const id = Number((req.params as { id: string }).id);
    const { rows } = await db.query(`SELECT ${GAME_COLUMNS} FROM games WHERE id = $1 AND user_id = $2`, [id, user.id]);
    return rows[0] ?? reply.status(404).send({ error: "Jeu introuvable" });
  });

  app.post("/games", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return reply;
    const g = gameCreateSchema.parse(req.body);
    const { rows } = await db.query(
      `INSERT INTO games (user_id, title, platform, status, rating, hours_played, cover_url, notes, finished_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${GAME_COLUMNS}`,
      [user.id, g.title, g.platform ?? null, g.status, g.rating ?? null, g.hoursPlayed, g.coverUrl ?? null, g.notes ?? null, g.finishedAt ?? null]
    );
    return reply.status(201).send(rows[0]);
  });

  const COLUMN_OF: Record<string, string> = {
    title: "title", platform: "platform", status: "status", rating: "rating",
    hoursPlayed: "hours_played", coverUrl: "cover_url", notes: "notes", finishedAt: "finished_at",
  };

  app.patch("/games/:id", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return reply;
    const id = Number((req.params as { id: string }).id);
    const patch = gameUpdateSchema.parse(req.body);
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
    if (!entries.length) return reply.status(400).send({ error: "Aucun champ à modifier" });
    const sets = entries.map(([k], i) => `${COLUMN_OF[k]} = $${i + 3}`);
    const { rows } = await db.query(
      `UPDATE games SET ${sets.join(", ")} WHERE id = $1 AND user_id = $2 RETURNING ${GAME_COLUMNS}`,
      [id, user.id, ...entries.map(([, v]) => v)]
    );
    return rows[0] ?? reply.status(404).send({ error: "Jeu introuvable" });
  });

  app.delete("/games/:id", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return reply;
    const id = Number((req.params as { id: string }).id);
    const { rows } = await db.query("DELETE FROM games WHERE id = $1 AND user_id = $2 RETURNING id", [id, user.id]);
    return rows.length ? reply.status(204).send() : reply.status(404).send({ error: "Jeu introuvable" });
  });

  // ---- Stats ----
  app.get("/stats", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return reply;
    const { rows } = await db.query(
      `SELECT status, rating, hours_played AS "hoursPlayed", platform, finished_at AS "finishedAt" FROM games WHERE user_id = $1`,
      [user.id]
    );
    const games = rows as { status: string; rating: number | null; hoursPlayed: number; platform: string | null; finishedAt: string | null }[];
    const count = <T extends string>(keys: (T | null)[]) =>
      keys.reduce<Record<string, number>>((acc, k) => (k ? { ...acc, [k]: (acc[k] ?? 0) + 1 } : acc), {});
    const rated = games.filter(g => g.rating != null);
    return {
      total: games.length,
      totalHours: games.reduce((s, g) => s + g.hoursPlayed, 0),
      averageRating: rated.length ? Math.round((rated.reduce((s, g) => s + (g.rating as number), 0) / rated.length) * 10) / 10 : null,
      byStatus: count(games.map(g => g.status)),
      byPlatform: count(games.map(g => g.platform)),
      finishedByYear: count(games.filter(g => g.status === "finished").map(g => g.finishedAt?.slice(0, 4) ?? null)),
    };
  });

  return app;
}
