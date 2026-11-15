# Backlog

Application web pour suivre sa pile de jeux vidéo : ce qu'on veut jouer, ce qu'on joue, ce qu'on a terminé ou abandonné. Chaque utilisateur a son compte et ses propres données.

## Fonctionnalités

- Inscription, connexion, déconnexion (session par cookie)
- Liste de jeux avec statut, plateforme, note, heures jouées et notes
- Recherche par titre, filtre par statut, pagination
- Changement de statut en un clic
- Statistiques : total, heures, note moyenne, répartition par statut et plateforme, jeux terminés par année

## Architecture

```
web/  Vue 3 + TypeScript + Pinia + Vue Router (Vite)
api/  Node + Fastify + Zod + PostgreSQL
```

```
Navigateur ──/api/*──> (proxy Vite en dev, rewrite Vercel en prod) ──> API Fastify ──> PostgreSQL
```

Le front appelle toujours `/api`, ce qui garde le cookie de session sur le même domaine : pas de CORS, pas de cookie tiers.

### Choix techniques

- **Session en base plutôt que JWT** : on peut l'invalider à la déconnexion. Le jeton aléatoire n'est jamais stocké en clair, seul son hash SHA-256 l'est.
- **Mots de passe** hachés avec bcrypt. Le message d'erreur de connexion est identique pour un email inconnu et un mauvais mot de passe.
- **Isolation des données** : chaque requête SQL sur `games` filtre sur `user_id`. Un test vérifie qu'un utilisateur ne peut ni lire, ni modifier, ni supprimer le jeu d'un autre.
- **Validation Zod** de toutes les entrées, requêtes SQL paramétrées.
- **Tests de l'API sans serveur Postgres** : `pg-mem` simule la base, donc `npm test` tourne partout, y compris en CI. La date de fin est stockée en texte ISO (`YYYY-MM-DD`) pour rester portable.

### API

| Méthode | Route | Rôle |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login`, `/auth/logout` | Compte et session |
| GET | `/auth/me` | Utilisateur courant |
| GET | `/games?status=&q=&page=&pageSize=` | Liste filtrée et paginée |
| GET / POST | `/games`, `/games/:id` | Lire, créer |
| PATCH / DELETE | `/games/:id` | Modifier, supprimer |
| GET | `/stats` | Statistiques |

## Lancer en local

Prérequis : Node 22 et une base PostgreSQL.

```bash
# API
cd api
cp .env.example .env     # adapter DATABASE_URL
npm install
DATABASE_URL=postgres://... npm run dev   # crée les tables au démarrage, port 3000

# Front (autre terminal)
cd web
npm install
npm run dev              # http://localhost:5173, /api redirigé vers localhost:3000
```

## Tests

```bash
cd api && npm test       # 10 tests : auth, isolation, CRUD, filtres, stats
cd web && npm test       # 5 tests : stores et gestion d'erreurs
cd web && npm run build  # typage + build de production
```

## Déploiement

1. Base : créer une base PostgreSQL gratuite (Neon ou Supabase) et récupérer l'URL de connexion.
2. API : déployer le dossier `api` (Render ou Fly) avec `DATABASE_URL` et `NODE_ENV=production`. Commande de démarrage : `npm start`.
3. Front : déployer le dossier `web` sur Vercel, après avoir remplacé l'URL dans `web/vercel.json` par celle de l'API.

## Pistes

- Recherche de jeux via l'API RAWG pour préremplir titre et jaquette
- Édition complète d'un jeu (note, heures, notes) depuis la liste
- Limitation du nombre de tentatives de connexion
