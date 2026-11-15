<script setup lang="ts">
import { reactive, ref } from "vue";
import { ApiError, STATUS_LABELS, type GameInput, type Status } from "../api";

const emit = defineEmits<{ submit: [GameInput]; cancel: [] }>();
const form = reactive({ title: "", platform: "", status: "to_play" as Status, rating: "", hoursPlayed: 0, notes: "" });
const error = ref("");
const busy = ref(false);

async function onSubmit() {
  error.value = "";
  busy.value = true;
  try {
    emit("submit", {
      title: form.title,
      platform: form.platform || null,
      status: form.status,
      rating: form.rating ? Number(form.rating) : null,
      hoursPlayed: Number(form.hoursPlayed) || 0,
      notes: form.notes || null,
      finishedAt: form.status === "finished" ? new Date().toISOString().slice(0, 10) : null,
    });
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Erreur inattendue";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form class="card" @submit.prevent="onSubmit">
    <h2>Ajouter un jeu</h2>
    <label>Titre <input v-model="form.title" required maxlength="200" /></label>
    <div class="row">
      <label>Plateforme <input v-model="form.platform" placeholder="PC, Switch…" maxlength="60" /></label>
      <label>
        Statut
        <select v-model="form.status">
          <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
      </label>
    </div>
    <div class="row">
      <label>Note (1 à 10) <input v-model="form.rating" type="number" min="1" max="10" /></label>
      <label>Heures jouées <input v-model.number="form.hoursPlayed" type="number" min="0" /></label>
    </div>
    <label>Notes <textarea v-model="form.notes" rows="2" maxlength="2000" /></label>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div class="row end">
      <button type="button" class="link" @click="emit('cancel')">Annuler</button>
      <button class="primary" :disabled="busy">Ajouter</button>
    </div>
  </form>
</template>
