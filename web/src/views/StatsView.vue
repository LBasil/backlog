<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api, ApiError, STATUS_LABELS, type Stats } from "../api";

const stats = ref<Stats | null>(null);
const error = ref("");

onMounted(async () => {
  try {
    stats.value = await api.stats();
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Erreur inattendue";
  }
});

function bars(data: Record<string, number>, label = (k: string) => k) {
  const max = Math.max(1, ...Object.values(data));
  return Object.entries(data).sort().map(([k, v]) => ({ label: label(k), value: v, width: (v / max) * 100 }));
}

const byStatus = computed(() => bars(stats.value?.byStatus ?? {}, k => STATUS_LABELS[k as keyof typeof STATUS_LABELS] ?? k));
const byPlatform = computed(() => bars(stats.value?.byPlatform ?? {}));
const byYear = computed(() => bars(stats.value?.finishedByYear ?? {}));
</script>

<template>
  <h1>Statistiques</h1>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <p v-else-if="!stats" class="hint">Chargement…</p>
  <p v-else-if="!stats.total" class="empty">Pas encore de données : ajoutez des jeux pour voir vos statistiques.</p>
  <template v-else>
    <div class="kpis">
      <div class="card"><strong>{{ stats.total }}</strong><span>jeux</span></div>
      <div class="card"><strong>{{ stats.totalHours }}</strong><span>heures jouées</span></div>
      <div class="card"><strong>{{ stats.averageRating ?? "–" }}</strong><span>note moyenne</span></div>
    </div>
    <section v-for="[title, rows] in ([['Par statut', byStatus], ['Par plateforme', byPlatform], ['Terminés par année', byYear]] as const)" :key="title" class="card">
      <h2>{{ title }}</h2>
      <p v-if="!rows.length" class="hint">Rien à afficher.</p>
      <div v-for="r in rows" :key="r.label" class="bar">
        <span>{{ r.label }}</span>
        <div class="track"><div class="fill" :style="{ width: r.width + '%' }" /></div>
        <span>{{ r.value }}</span>
      </div>
    </section>
  </template>
</template>
