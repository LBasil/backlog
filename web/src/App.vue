<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuth } from "./stores/auth";

const auth = useAuth();
const router = useRouter();

async function logout() {
  await auth.logout();
  router.push({ name: "login" });
}
</script>

<template>
  <header class="topbar">
    <RouterLink to="/" class="brand">Backlog</RouterLink>
    <nav v-if="auth.user">
      <RouterLink to="/">Mes jeux</RouterLink>
      <RouterLink to="/stats">Statistiques</RouterLink>
      <button class="link" @click="logout">Déconnexion</button>
    </nav>
  </header>
  <main><RouterView /></main>
</template>
