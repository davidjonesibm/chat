# Chat

Real-time group chat PWA built with Vue 3, Fastify, @fastify/websocket, and Supabase.

## Prerequisites

- Node.js 20+
- pnpm 10+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)
- Docker (required for local Supabase)

## First-time setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start local Supabase

```bash
cd apps/backend
supabase start
```

This starts a local Supabase stack (Postgres, Auth, REST API, Studio) via Docker.
Note the output — you'll need the API URL, anon key, service role key, and JWT secret.

Once running, open Studio at **http://localhost:54323**.

### 3. Apply migrations

```bash
supabase db reset
```

This runs all migrations in `apps/backend/supabase/migrations/`, creating the `profiles`, `groups`, `group_members`, `channels`, and `messages` tables along with the `handle_new_user` trigger.

### 4. Configure environment variables

Create `apps/backend/.env`:

```bash
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start output>
SUPABASE_ANON_KEY=<anon key from supabase start output>
PORT=3000
```

Create `apps/frontend/.env`:

```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase start output>
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

## Using pnpm & Nx commands

This repo is an [Nx monorepo](https://nx.dev) managed with pnpm workspaces. Always prefix `nx` with `pnpm` so the workspace-local version is used — never rely on a globally installed `nx`.

### Installing dependencies

```bash
pnpm install           # install all workspace dependencies
pnpm install --filter @chat/backend   # install for one package only
pnpm add <pkg> --filter @chat/backend # add a dependency to a specific package
```

### Running targets

```bash
# Generic form
pnpm nx run <project>:<target>
pnpm nx run <project>:<target>:<configuration>

# Common shortcuts (nx infers the project from the name)
pnpm nx serve backend          # start backend in watch/dev mode (tsx watch)
pnpm nx dev frontend           # start Vite dev server
pnpm nx build backend          # production build → dist/apps/backend/
pnpm nx build frontend         # production build → dist/apps/frontend/
pnpm nx test frontend          # run Vitest unit tests
pnpm nx lint backend           # ESLint
```

### Running across the whole workspace

```bash
pnpm nx run-many -t build           # build every project
pnpm nx run-many -t test lint       # test + lint every project in parallel
pnpm nx affected -t build test      # only projects affected by your changes
```

### Inspecting the workspace

```bash
pnpm nx show projects              # list all projects
pnpm nx show project frontend --web  # open interactive target explorer
pnpm nx graph                      # open dependency graph in browser
```

### Caching

Nx caches task outputs locally in `.nx/cache`. Re-running an unchanged target is instant. To force a fresh run:

```bash
pnpm nx run backend:build --skip-nx-cache
```

---

## Running in development

Each service needs its own terminal:

### Terminal 1 — Supabase (local)

```bash
cd apps/backend && supabase start
```

Keep this running. Studio is at **http://localhost:54323**.

### Terminal 2 — Backend (Fastify + WebSocket)

```bash
pnpm nx serve backend
```

Runs on **http://localhost:3000**

### Terminal 3 — Frontend (Vue 3 + Vite)

```bash
pnpm nx dev frontend
```

Runs on **http://localhost:4200**

## Usage

1. Open **http://localhost:4200**
2. Register an account or log in
3. You'll be taken to the `#general` channel
4. Send messages — they appear in real time for all connected users

## Project structure

```
apps/
  backend/      Fastify 5 + WebSocket API server
  frontend/     Vue 3 + Vite + DaisyUI PWA
lbs/
  shared/       Shared TypeScript types (@chat/shared)
docs/
  ARCHITECTURE.md  Full architecture reference
```

## Environment

Defaults work out of the box after `supabase start`. Override via `.env` files:

| File                 | Variable                    | Default                  |
| -------------------- | --------------------------- | ------------------------ |
| `apps/backend/.env`  | `SUPABASE_URL`              | `http://localhost:54321` |
| `apps/backend/.env`  | `SUPABASE_SERVICE_ROLE_KEY` | _(from supabase start)_  |
| `apps/backend/.env`  | `SUPABASE_ANON_KEY`         | _(from supabase start)_  |
| `apps/backend/.env`  | `PORT`                      | `3000`                   |
| `apps/frontend/.env` | `VITE_SUPABASE_URL`         | `http://localhost:54321` |
| `apps/frontend/.env` | `VITE_SUPABASE_ANON_KEY`    | _(from supabase start)_  |
| `apps/frontend/.env` | `VITE_API_URL`              | `http://localhost:3000`  |
| `apps/frontend/.env` | `VITE_WS_URL`               | `http://localhost:3000`  |
