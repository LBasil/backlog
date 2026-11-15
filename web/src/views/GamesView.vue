<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ApiError, STATUS_LABELS, type GameInput } from "../api";
import GameCard from "../components/GameCard.vue";
import GameForm from "../components/GameForm.vue";
import { useGames } from "../stores/games";

const games = useGames();
const adding = ref(false);
const actionError = ref("");
let timer: ReturnType<typeof setTimeout>;

onMounted(() => games.load());

function onSearch(e: Event) {
  clearTimeout(timer);
  const q = (e.target as HTMLInputElement).value;
  timer = setTimeout(() => games.setFilter({ q }), 300);
}

async function guard(action: () => Promise<unknown>) {
  actionError.value = "";
  try {
    await action();
  } catch (e) {
    actionError.value = e instanceof ApiError ? e.message : "Erreur inattendue";
  }
}

async function add(game: GameInput) {
  await guard(async () => {
    await games.add(game);
    adding.value = false;
  });
}
</script>

<template>
  <div class="toolbar">
    <input type="search" placeholder="Rechercher un titre" aria-label="Rechercher un titre" @input="onSearch" />
    <select :value="games.status" aria-label="Filtrer par statut" @change="games.setFilter({ status: ($event.target as HTMLSelectElement).value })">
      <option value="">Tous les statuts</option>
      <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
    </select>
    <button class="primary" @click="adding = true">Ajouter un jeu</button>
  </div>

  <GameForm v-if="adding" @submit="add" @cancel="adding = false" />
  <p v-if="actionError" class="error" role="alert">{{ actionError }}</p>
  <p v-if="games.error" class="error" role="alert">{{ games.error }} <button class="link" @click="games.load()">Réessayer</button></p>

  <p v-if="games.loading && !games.items.length" class="hint">Chargement…</p>
  <p v-else-if="!games.items.length && !games.error" class="empty">
    {{ games.q || games.status ? "Aucun jeu ne correspond à ces filtres." : "Votre backlog est vide. Ajoutez votre premier jeu." }}
  </p>

  <GameCard
    v-for="g in games.items"
    :key="g.id"
    :game="g"
    @status="s => guard(() => games.update(g.id, { status: s, finishedAt: s === 'finished' ? new Date().toISOString().slice(0, 10) : null }))"
    @remove="guard(() => games.remove(g.id))"
  />

  <nav v-if="games.pageCount > 1" class="pager" aria-label="Pagination">
    <button :disabled="games.page === 1" @click="games.goTo(games.page - 1)">Précédent</button>
    <span>Page {{ games.page }} / {{ games.pageCount }}</span>
    <button :disabled="games.page === games.pageCount" @click="games.goTo(games.page + 1)">Suivant</button>
  </nav>
</template>
