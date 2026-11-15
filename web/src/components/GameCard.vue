<script setup lang="ts">
import { STATUS_LABELS, type Game, type Status } from "../api";

defineProps<{ game: Game }>();
const emit = defineEmits<{ status: [Status]; remove: [] }>();
</script>

<template>
  <article class="game">
    <div>
      <h3>{{ game.title }}</h3>
      <p class="meta">
        <span v-if="game.platform">{{ game.platform }}</span>
        <span>{{ game.hoursPlayed }} h</span>
        <span v-if="game.rating">{{ game.rating }}/10</span>
      </p>
      <p v-if="game.notes" class="notes">{{ game.notes }}</p>
    </div>
    <div class="actions">
      <select :value="game.status" :aria-label="`Statut de ${game.title}`" @change="emit('status', ($event.target as HTMLSelectElement).value as Status)">
        <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
      <button class="link danger" @click="emit('remove')">Supprimer</button>
    </div>
  </article>
</template>
