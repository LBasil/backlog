import { buildApp } from "./app.js";
import { createPool, migrate } from "./db.js";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant");
  process.exit(1);
}

const pool = createPool(url);
await migrate(pool);

const app = buildApp({
  db: pool,
  corsOrigin: process.env.CORS_ORIGIN,
  secureCookie: process.env.NODE_ENV === "production",
});

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });
console.log(`API prête sur le port ${port}`);
