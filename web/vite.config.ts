import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

// En développement, /api est redirigé vers l'API locale ; en production, vercel.json fait la même chose.
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: { "/api": { target: "http://localhost:3000", rewrite: p => p.replace(/^\/api/, "") } },
  },
  test: { environment: "jsdom" },
});
