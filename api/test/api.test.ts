import { beforeEach, describe, expect, it } from "vitest";
import { newDb } from "pg-mem";
import { buildApp } from "../src/app.js";
import { migrate } from "../src/db.js";

async function setup() {
  const { Pool } = newDb().adapters.createPg();
  const db = new Pool();
  await migrate(db);
  return buildApp({ db });
}

type App = Awaited<ReturnType<typeof setup>>;
let app: App;

beforeEach(async () => {
  app = await setup();
});

async function register(email = "a@test.fr", password = "motdepasse1") {
  const res = await app.inject({ method: "POST", url: "/auth/register", payload: { email, password } });
  const raw = res.headers["set-cookie"];
  const cookie = String(Array.isArray(raw) ? raw[0] : raw ?? "").split(";")[0];
  return { res, cookie };
}

const auth = (cookie: string) => ({ cookie });

describe("auth", () => {
  it("inscrit, puis identifie l'utilisateur par son cookie", async () => {
    const { res, cookie } = await register();
    expect(res.statusCode).toBe(201);
    const me = await app.inject({ method: "GET", url: "/auth/me", headers: auth(cookie) });
    expect(me.json().user.email).toBe("a@test.fr");
  });

  it("refuse un email déjà pris et un mot de passe trop court", async () => {
    await register();
    expect((await register()).res.statusCode).toBe(409);
    const short = await app.inject({ method: "POST", url: "/auth/register", payload: { email: "b@test.fr", password: "court" } });
    expect(short.statusCode).toBe(400);
  });

  it("connecte avec le bon mot de passe seulement, même message d'erreur sinon", async () => {
    await register();
    const bad = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "a@test.fr", password: "mauvaismdp1" } });
    const unknown = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "z@test.fr", password: "motdepasse1" } });
    expect(bad.statusCode).toBe(401);
    expect(unknown.json().error).toBe(bad.json().error);
    const ok = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "A@Test.fr", password: "motdepasse1" } });
    expect(ok.statusCode).toBe(200);
  });

  it("la déconnexion invalide la session", async () => {
    const { cookie } = await register();
    await app.inject({ method: "POST", url: "/auth/logout", headers: auth(cookie) });
    const me = await app.inject({ method: "GET", url: "/auth/me", headers: auth(cookie) });
    expect(me.statusCode).toBe(401);
  });

  it("protège les routes sans session", async () => {
    for (const url of ["/games", "/stats"]) {
      expect((await app.inject({ method: "GET", url })).statusCode).toBe(401);
    }
  });
});

describe("games", () => {
  it("crée, lit, modifie et supprime un jeu", async () => {
    const { cookie } = await register();
    const created = await app.inject({ method: "POST", url: "/games", headers: auth(cookie), payload: { title: "Hades", platform: "PC" } });
    expect(created.statusCode).toBe(201);
    const game = created.json();
    expect(game).toMatchObject({ title: "Hades", status: "to_play", hoursPlayed: 0 });

    const patched = await app.inject({ method: "PATCH", url: `/games/${game.id}`, headers: auth(cookie), payload: { status: "finished", rating: 9, hoursPlayed: 30, finishedAt: "2026-03-01" } });
    expect(patched.json()).toMatchObject({ status: "finished", rating: 9, hoursPlayed: 30, finishedAt: "2026-03-01" });

    expect((await app.inject({ method: "DELETE", url: `/games/${game.id}`, headers: auth(cookie) })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: `/games/${game.id}`, headers: auth(cookie) })).statusCode).toBe(404);
  });

  it("valide les données", async () => {
    const { cookie } = await register();
    const bad = await app.inject({ method: "POST", url: "/games", headers: auth(cookie), payload: { title: "", rating: 11 } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().details.length).toBeGreaterThan(0);
  });

  it("isole les jeux de chaque utilisateur", async () => {
    const a = await register("a@test.fr");
    const b = await register("b@test.fr");
    const game = (await app.inject({ method: "POST", url: "/games", headers: auth(a.cookie), payload: { title: "Celeste" } })).json();
    expect((await app.inject({ method: "GET", url: "/games", headers: auth(b.cookie) })).json().total).toBe(0);
    expect((await app.inject({ method: "PATCH", url: `/games/${game.id}`, headers: auth(b.cookie), payload: { title: "Volé" } })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: `/games/${game.id}`, headers: auth(b.cookie) })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: `/games/${game.id}`, headers: auth(a.cookie) })).json().title).toBe("Celeste");
  });

  it("filtre par statut, recherche par titre et pagine", async () => {
    const { cookie } = await register();
    const add = (title: string, status?: string) => app.inject({ method: "POST", url: "/games", headers: auth(cookie), payload: { title, status } });
    await add("Hades", "finished");
    await add("Hollow Knight", "playing");
    await add("Hades II");
    await add("Celeste", "finished");

    const finished = (await app.inject({ method: "GET", url: "/games?status=finished", headers: auth(cookie) })).json();
    expect(finished.total).toBe(2);
    const search = (await app.inject({ method: "GET", url: "/games?q=HADES", headers: auth(cookie) })).json();
    expect(search.items.map((g: { title: string }) => g.title).sort()).toEqual(["Hades", "Hades II"]);
    const page = (await app.inject({ method: "GET", url: "/games?pageSize=3&page=2", headers: auth(cookie) })).json();
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(4);
  });
});

describe("stats", () => {
  it("calcule les totaux de l'utilisateur", async () => {
    const { cookie } = await register();
    const add = (payload: object) => app.inject({ method: "POST", url: "/games", headers: auth(cookie), payload });
    await add({ title: "A", platform: "PC", status: "finished", rating: 9, hoursPlayed: 20, finishedAt: "2025-05-01" });
    await add({ title: "B", platform: "PC", status: "finished", rating: 8, hoursPlayed: 10, finishedAt: "2026-01-01" });
    await add({ title: "C", platform: "Switch", status: "playing", hoursPlayed: 5 });
    const stats = (await app.inject({ method: "GET", url: "/stats", headers: auth(cookie) })).json();
    expect(stats).toMatchObject({
      total: 3,
      totalHours: 35,
      averageRating: 8.5,
      byStatus: { finished: 2, playing: 1 },
      byPlatform: { PC: 2, Switch: 1 },
      finishedByYear: { "2025": 1, "2026": 1 },
    });
  });
});
