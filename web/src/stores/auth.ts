import { defineStore } from "pinia";
import { api, type User } from "../api";

export const useAuth = defineStore("auth", {
  state: () => ({ user: null as User | null, ready: false }),
  actions: {
    async restore() {
      try {
        this.user = (await api.me()).user;
      } catch {
        this.user = null;
      } finally {
        this.ready = true;
      }
    },
    async login(email: string, password: string) {
      this.user = (await api.login(email, password)).user;
    },
    async register(email: string, password: string) {
      this.user = (await api.register(email, password)).user;
    },
    async logout() {
      await api.logout().catch(() => undefined);
      this.user = null;
    },
  },
});
