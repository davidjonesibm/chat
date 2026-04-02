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

## Commands

### Installing dependencies

```bash
pnpm install                                  # install all workspace dependencies
pnpm add <pkg> --filter @chat/backend         # add a dependency to a specific package
```

### Development

```bash
pnpm dev:frontend      # start Vite dev server (port 4200)
pnpm dev:backend       # start backend in watch mode (tsx watch)
```

### Building

```bash
pnpm build                            # build all packages
pnpm build:frontend                   # build frontend only
pnpm build:backend                    # build backend only
```

### Testing & Linting

```bash
pnpm test              # test all packages
pnpm lint              # lint all packages
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
pnpm dev:backend
```

Runs on **http://localhost:3000**

### Terminal 3 — Frontend (Vue 3 + Vite)

```bash
pnpm dev:frontend
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
