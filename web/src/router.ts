import { createRouter, createWebHistory } from "vue-router";
import { useAuth } from "./stores/auth";
import LoginView from "./views/LoginView.vue";
import GamesView from "./views/GamesView.vue";
import StatsView from "./views/StatsView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "games", component: GamesView, meta: { auth: true } },
    { path: "/stats", name: "stats", component: StatsView, meta: { auth: true } },
    { path: "/connexion", name: "login", component: LoginView },
    { path: "/:rest(.*)*", redirect: "/" },
  ],
});

router.beforeEach(async to => {
  const auth = useAuth();
  if (!auth.ready) await auth.restore();
  if (to.meta.auth && !auth.user) return { name: "login" };
  if (to.name === "login" && auth.user) return { name: "games" };
});
