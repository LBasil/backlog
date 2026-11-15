import { defineStore } from "pinia";
import { api, ApiError, type Game, type GameInput } from "../api";

export const useGames = defineStore("games", {
  state: () => ({
    items: [] as Game[],
    total: 0,
    page: 1,
    pageSize: 20,
    status: "" as string,
    q: "",
    loading: false,
    error: "",
  }),
  getters: {
    pageCount: s => Math.max(1, Math.ceil(s.total / s.pageSize)),
  },
  actions: {
    async load() {
      this.loading = true;
      this.error = "";
      try {
        const res = await api.listGames({ status: this.status, q: this.q, page: this.page });
        Object.assign(this, { items: res.items, total: res.total, pageSize: res.pageSize });
      } catch (e) {
        this.error = e instanceof ApiError ? e.message : "Erreur inattendue";
      } finally {
        this.loading = false;
      }
    },
    async setFilter(patch: { status?: string; q?: string }) {
      Object.assign(this, patch, { page: 1 });
      await this.load();
    },
    async goTo(page: number) {
      this.page = Math.min(Math.max(1, page), this.pageCount);
      await this.load();
    },
    async add(game: GameInput) {
      await api.createGame(game);
      await this.load();
    },
    async update(id: number, patch: Partial<GameInput>) {
      const updated = await api.updateGame(id, patch);
      this.items = this.items.map(g => (g.id === id ? updated : g));
    },
    async remove(id: number) {
      await api.deleteGame(id);
      if (this.items.length === 1 && this.page > 1) this.page -= 1;
      await this.load();
    },
  },
});
