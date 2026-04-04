---
applyTo: '**'
---

# Codebase Instructions

**BEFORE planning or implementing any feature, read [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).** It is the authoritative living reference for this codebase.

## Stack Quick-Reference

| Concern            | Location                                 | Notes                                      |
| ------------------ | ---------------------------------------- | ------------------------------------------ |
| Frontend app       | `apps/frontend/`                         | Vue 3 + TypeScript + DaisyUI (Tailwind)    |
| Backend app        | `apps/backend/`                          | Fastify + TypeScript                       |
| Shared types       | `libs/shared/`                           | Imported as `@chat/shared`                 |
| Auth               | Supabase                                 | Frontend SDK for auth only                 |
| Database           | PocketBase                               | Group / channel / message data             |
| Real-time          | Fastify WebSocket (`@fastify/websocket`) | Ephemeral: typing, presence, message relay |
| Push notifications | `web-push` (VAPID) via Fastify           | Served from `routes/push.ts`               |
| PWA                | `vite-plugin-pwa` (`injectManifest`)     | Service worker in `apps/frontend/`         |
| Monorepo tooling   | pnpm workspaces                          | Run tasks via `pnpm --filter …`            |

## Shared Types (`@chat/shared`)

- Always import types from `@chat/shared` — never redefine locally what already exists there.
- All DB record types **must** extend `BaseRecord` (provides `id`, `created_at`, `updated_at`).
- Follow the `*Record → Pick<>` pattern: `*Record` is the full DB row; API-facing shapes are `Pick<*Record, ...>` subsets.
- Use `*Request` / `*Response` for every API endpoint payload pair.
- WebSocket messages use `ClientMessage` / `ServerMessage` discriminated unions (keyed on `type`).
- Use `MessageWithSender` for read-heavy message responses (avoids N+1 joins).
- Use `PaginatedResponse<T>` for any paginated endpoint.

## Frontend Conventions

- **Composition API only** — never use Options API.
- State management: **Pinia** stores in `stores/` (`*Store` naming, e.g. `chatStore`).
- Reusable logic: composables in `composables/` (`use*` naming, e.g. `useChat`).
- Components: `components/auth/` and `components/chat/`; route-level components in `views/` (`*View.vue`).
- **Supabase SDK is for auth only** — never use it for direct DB queries.
- All application data flows through the **Fastify REST API**.

## Backend Conventions

- New routes → `routes/` directory; register with descriptive Fastify plugin names (`*Plugin`).
- New plugins → `plugins/` directory.
- Always use `@chat/shared` types for request/response shapes.
- **Validate all input** with Fastify JSON Schema (attach `schema` to each route).
- DB access uses the Supabase **service-role client** — never the anon key on the server.
- WebSocket auth: JWT passed as query param (`/ws?token=JWT`); validated in `plugins/auth.ts`.

## WebSocket Type Safety

- Every new WS message type **must** be added to the `ClientMessage` or `ServerMessage` discriminated union in `libs/shared/src/types/events.ts`.
- Never send untyped / ad-hoc JSON over the WebSocket — always use the shared union types.

## Naming Conventions

| Thing                     | Convention               | Example                |
| ------------------------- | ------------------------ | ---------------------- |
| DB record type            | `*Record`                | `ChannelRecord`        |
| API request/response      | `*Request` / `*Response` | `CreateChannelRequest` |
| Composable                | `use*`                   | `useChannels`          |
| Pinia store               | `*Store`                 | `channelStore`         |
| Route-level Vue component | `*View.vue`              | `ChatView.vue`         |
| Fastify plugin            | `*Plugin`                | `authPlugin`           |

## Database Types Contract

`apps/backend/database.types.ts` is the hand-maintained Supabase type file. `supabaseAdmin` is typed as `SupabaseClient<Database>` — every table must have `Row`, `Insert`, `Update`, and `Relationships` entries in that file.

**Every SQL migration that creates a new table MUST be accompanied by a corresponding addition to `database.types.ts`.** Never cast `supabaseAdmin as any` to work around a missing table type — adding the type is the fix.

## Do NOT

- Query Supabase directly from the frontend (except auth).
- Use the Vue Options API anywhere.
- Define types locally that belong in `@chat/shared`.
- Add fields to `BaseRecord` — it is a fixed base interface.
- Send untyped JSON over WebSocket.
- Bypass Fastify JSON Schema validation for user-supplied input.
- Cast `supabaseAdmin as any` (or `untypedAdmin`) — update `database.types.ts` instead.
