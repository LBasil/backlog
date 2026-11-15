<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { ApiError } from "../api";
import { useAuth } from "../stores/auth";

const auth = useAuth();
const router = useRouter();
const mode = ref<"login" | "register">("login");
const email = ref("");
const password = ref("");
const error = ref("");
const busy = ref(false);

async function submit() {
  error.value = "";
  busy.value = true;
  try {
    await (mode.value === "login" ? auth.login : auth.register)(email.value, password.value);
    router.push({ name: "games" });
  } catch (e) {
    error.value = e instanceof ApiError ? (e.details[0]?.message ?? e.message) : "Erreur inattendue";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="card narrow">
    <h1>{{ mode === "login" ? "Connexion" : "Créer un compte" }}</h1>
    <form @submit.prevent="submit">
      <label>Email <input v-model="email" type="email" autocomplete="email" required /></label>
      <label>
        Mot de passe
        <input v-model="password" type="password" minlength="8" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" required />
      </label>
      <p v-if="mode === 'register'" class="hint">8 caractères minimum.</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="primary" :disabled="busy">{{ mode === "login" ? "Se connecter" : "S'inscrire" }}</button>
    </form>
    <button class="link" @click="mode = mode === 'login' ? 'register' : 'login'">
      {{ mode === "login" ? "Pas de compte ? Inscrivez-vous" : "Déjà un compte ? Connectez-vous" }}
    </button>
  </section>
</template>
