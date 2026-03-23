# Chat

Real-time group chat PWA built with Vue 3, Fastify, @fastify/websocket, and PocketBase.

## Prerequisites

- Node.js 20+
- pnpm 10+
- (PocketBase binary is included at `pocketbase/pocketbase`)

## First-time setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up PocketBase (one-time)

Start PocketBase and create the superuser:

```bash
cd pocketbase && ./pocketbase serve --http=localhost:8090
```

Open the Admin UI at **http://localhost:8090/\_/** and create your superuser account.

Then create these collections in the Admin UI:

#### Collection: `groups`

| Field         | Type             | Options  |
| ------------- | ---------------- | -------- |
| `name`        | Text             | Required |
| `description` | Text             |          |
| `owner`       | Relation → users | Single   |
| `members`     | Relation → users | Multiple |

Set API rules: all rules → `@request.auth.id != ""`

#### Collection: `channels`

| Field         | Type              | Options          |
| ------------- | ----------------- | ---------------- |
| `name`        | Text              | Required         |
| `group`       | Relation → groups | Single, Required |
| `description` | Text              |                  |
| `is_default`  | Bool              |                  |

Set API rules: all rules → `@request.auth.id != ""`

#### Collection: `messages`

| Field     | Type                | Options                   |
| --------- | ------------------- | ------------------------- |
| `content` | Text                | Required                  |
| `channel` | Relation → channels | Single, Required          |
| `sender`  | Relation → users    | Single, Required          |
| `type`    | Select              | Options: `text`, `system` |

Set API rules: all rules → `@request.auth.id != ""`

### 3. Create the "general" channel

In the PocketBase Admin UI:

1. Create a record in `groups`: name = `General`
2. Create a record in `channels`: name = `general`, group = (the group you just created), is_default = true

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
pnpm nx run pocketbase:serve   # start PocketBase server
pnpm nx run pocketbase:migrate # run pending PocketBase migrations
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

### Terminal 1 — PocketBase

```bash
cd pocketbase && ./pocketbase serve --http=localhost:8090
```

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
libs/
  shared/       Shared TypeScript types (@chat/shared)
pocketbase/     PocketBase binary + data
docs/
  ARCHITECTURE.md  Full architecture reference
```

## Environment

Defaults work out of the box. Override via `.env` files:

| File                 | Variable              | Default                 |
| -------------------- | --------------------- | ----------------------- |
| `apps/backend/.env`  | `POCKETBASE_URL`      | `http://localhost:8090` |
| `apps/backend/.env`  | `PORT`                | `3000`                  |
| `apps/frontend/.env` | `VITE_POCKETBASE_URL` | `http://localhost:8090` |
| `apps/frontend/.env` | `VITE_API_URL`        | `http://localhost:3000` |
| `apps/frontend/.env` | `VITE_WS_URL`         | `http://localhost:3000` |
