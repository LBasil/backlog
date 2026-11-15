import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGames } from "../src/stores/games";
import { useAuth } from "../src/stores/auth";

const ok = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("games store", () => {
  it("charge la liste avec les filtres et remet la page à 1 quand ils changent", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(() => ok({ items: [], total: 0, page: 1, pageSize: 20 }));
    const games = useGames();
    games.page = 3;
    await games.setFilter({ status: "playing", q: "hades" });
    expect(games.page).toBe(1);
    expect(String(spy.mock.calls[0][0])).toBe("/api/games?status=playing&q=hades&page=1");
  });

  it("expose un message d'erreur lisible quand le serveur répond mal", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => ok({ error: "Connexion requise" }, 401));
    const games = useGames();
    await games.load();
    expect(games.error).toBe("Connexion requise");
    expect(games.loading).toBe(false);
  });

  it("signale un serveur injoignable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("network"));
    const games = useGames();
    await games.load();
    expect(games.error).toContain("joindre le serveur");
  });

  it("calcule le nombre de pages", () => {
    const games = useGames();
    games.total = 41;
    expect(games.pageCount).toBe(3);
  });
});

describe("auth store", () => {
  it("restore passe prêt même sans session", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => ok({ error: "Connexion requise" }, 401));
    const auth = useAuth();
    await auth.restore();
    expect(auth.user).toBeNull();
    expect(auth.ready).toBe(true);
  });
});
