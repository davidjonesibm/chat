# Comprehensive Audit Results & Improvement Plan

Eight specialist agents analyzed every layer of this application. Below are all findings organized by priority, followed by a phased implementation plan.

## CRITICAL Issues (Fix Immediately)

| #   | Layer    | Issue                                                                                                               | Impact                              |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| C1  | Backend  | No authorization on WS channel:join — any authenticated user can eavesdrop on any channel                           | Data breach                         |
| C2  | Backend  | No authorization on WS message:send — any user can post to any channel                                              | Data integrity                      |
| C3  | Supabase | Overly permissive RLS SELECT policies — all authenticated users can read all messages/groups/channels via PostgREST | Data breach via direct Supabase API |
| C4  | Supabase | Invite tokens readable by all users — anyone can enumerate and use invite tokens                                    | Unauthorized group access           |
| C5  | Supabase | Chat-images bucket has no folder scoping — any user can upload to any path                                          | File overwrite / abuse              |
| C6  | PWA      | NetworkFirst used for POST mutations — should be NetworkOnly with BackgroundSync                                    | Stale mutation responses cached     |
| C7  | iOS      | API keys hardcoded in Config.swift                                                                                  | Secrets in source control           |
| C8  | iOS      | SocketStream is @unchecked Sendable with unguarded mutable state                                                    | Data race / crash                   |

## HIGH Issues

| #   | Layer    | Issue                                                                                  |
| --- | -------- | -------------------------------------------------------------------------------------- |
| H1  | Backend  | Push sender throws on single failure, aborting entire batch → use `Promise.allSettled` |
| H2  | Backend  | Channel deletion allows any group member (no owner check)                              |
| H3  | Backend  | N+1 query in `GET /groups` (per-group member fetch)                                    |
| H4  | Backend  | Module-level Maps in `chat.ts` with fragile lifecycle management                       |
| H5  | Supabase | `messages.sender_id ON DELETE CASCADE` — deleting a user wipes all their messages      |
| H6  | Supabase | Missing index on `group_members.user_id` (every page load)                             |
| H7  | Supabase | Missing index on `channels.group_id`                                                   |
| H8  | Supabase | Email confirmation disabled in config                                                  |
| H9  | Supabase | Weak password policy (6 chars, no requirements)                                        |
| H10 | Supabase | `message_reactions` INSERT policy has no group membership check                        |
| H11 | Supabase | `messages.seq` column missing from migrations (type drift)                             |
| H12 | PWA      | No runtime caching for API GET requests — offline = immediate failure                  |
| H13 | PWA      | No offline fallback page (`setCatchHandler`)                                           |
| H14 | PWA      | `registerType: 'autoUpdate'` silently reloads mid-session                              |
| H15 | PWA      | Same image used for `any` and `maskable` icon (crops incorrectly on Android)           |
| H16 | Frontend | `onAuthStateChange` subscription never unsubscribed (memory leak)                      |
| H17 | Frontend | `!` non-null assertion operator used (violates project convention)                     |
| H18 | Caddy    | No security headers (HSTS, X-Content-Type-Options, X-Frame-Options, etc.)              |
| H19 | Docker   | Empty `docker/` directories — zero containerization                                    |
| H20 | Backend  | No graceful shutdown signal handling (`SIGTERM`/`SIGINT`)                              |
| H21 | iOS      | `fatalError()` in AuthService init — crashes on invalid URL                            |
| H22 | iOS      | Excessive computed `some View` properties defeat SwiftUI diffing                       |
| H23 | iOS      | `DispatchQueue.main.async` used instead of `@MainActor`                                |

## MEDIUM Issues

| #   | Layer    | Issue                                                                        |
| --- | -------- | ---------------------------------------------------------------------------- |
| M1  | Backend  | Missing `additionalProperties: false` on ALL body schemas (mass assignment)  |
| M2  | Backend  | Missing `maxLength` on ALL string inputs (DoS via huge payloads)             |
| M3  | Backend  | No WS message schema validation (`JSON.parse` → cast)                        |
| M4  | Backend  | No WS rate limiting                                                          |
| M5  | Backend  | SSRF via push subscription endpoint (no URL validation)                      |
| M6  | Backend  | Missing `trustProxy` behind Caddy                                            |
| M7  | Backend  | Auth calls Supabase net round-trip per request (no local JWT verify)         |
| M8  | Backend  | Group creation not transactional (orphaned records on partial failure)       |
| M9  | Backend  | `console.log` throughout `chat.ts` instead of Pino logger                    |
| M10 | Frontend | `postMessage` handler missing origin validation (navigation hijack)          |
| M11 | Frontend | 4 modals use `modelValue` + emit instead of `defineModel()`                  |
| M12 | Frontend | Deep reactivity on large messages array → use `shallowRef`                   |
| M13 | Frontend | Broken/stale `App.spec.ts` test                                              |
| M14 | Supabase | No `updated_at` auto-update trigger on any table                             |
| M15 | Supabase | `handle_new_user()` trigger has no conflict handling for duplicate usernames |
| M16 | Supabase | `messages.channel_id` is nullable (should be `NOT NULL`)                     |
| M17 | PWA      | SW `postMessage` listener on `window` instead of `navigator.serviceWorker`   |
| M18 | PWA      | No `beforeinstallprompt` handling                                            |
| M19 | PWA      | No `navigator.storage.persist()` for persistent storage                      |
| M20 | PWA      | Push subscription not re-synced on revisit                                   |
| M21 | iOS      | `onDisappear` fires prematurely for channel cleanup                          |
| M22 | iOS      | No retry logic in `APIClient` for transient failures                         |
| M23 | iOS      | `URLSession.shared` used without custom configuration                        |
| M24 | Caddy    | Hardcoded LAN IP and absolute filesystem paths                               |
| M25 | Config   | `tsconfig.base.json` targets `es2015` (very conservative)                    |
| M26 | Config   | `emitDecoratorMetadata` + `experimentalDecorators` (dead config)             |
| M27 | Config   | Ghost dependency `pocketbase` in root `package.json`                         |
| M28 | Config   | Dependencies hoisted to root that belong in app `package.json`               |

## Dependency Upgrades Needed

| Package              | Current           | Latest   | Action                      |
| -------------------- | ----------------- | -------- | --------------------------- |
| `esbuild`            | `^0.19.2`         | `0.28.0` | Upgrade (severely outdated) |
| `@fastify/cors`      | `^10.0.0`         | `11.2.0` | Upgrade (major)             |
| `@fastify/multipart` | `^9.0.0`          | `10.0.0` | Upgrade (major)             |
| `fastify`            | `~5.2.1`          | `5.8.4`  | Widen to `^5.2.1`           |
| `fastify-plugin`     | `~5.0.1`          | `5.1.0`  | Widen to `^5.0.1`           |
| `prettier`           | `~3.6.2`          | `3.8.1`  | Widen to `^3.6.2`           |
| `vitest`             | `~4.0.0`          | `4.1.3`  | Widen to `^4.0.0`           |
| `vue-router`         | `^4.5.0`          | `5.0.4`  | Investigate v5 migration    |
| `vite-plugin-pwa`    | in `dependencies` | —        | Move to `devDependencies`   |
| `pocketbase`         | `^0.26.8`         | —        | Remove (ghost dependency)   |

## Proposed Implementation Plan

### Phase 1: Security (Critical + High Security)

_Fixes C1–C5, H2, H10, M1–M5, M6, M10_

- Add WS authorization checks for `channel:join` and `message:send` (verify group membership)
- Lock down RLS SELECT policies (scope to group membership) - do we need to lock down RLS? all GETs are protected by the fastify backend.
- Fix invite token visibility (restrict to creator/group owner)
- Add folder scoping to chat-images bucket policy
- Add owner-only check for channel deletion
- Add `additionalProperties: false` + `maxLength` to all body schemas
- Add WS message validation (runtime type guard)
- Add WS rate limiting (token bucket per socket)
- Validate push subscription endpoint URLs (SSRF prevention)
- Add `trustProxy: true`
- Fix `postMessage` origin validation in `App.vue`

Phase 1 follow-up items from implementation/review:

- Add `code: 'INVALID_GIF_URL'` to the two pre-existing Giphy validation WebSocket error payloads in `chat.ts` for consistency with the rest of the error contract.
- Update `handleReactionToggle` in `chat.ts` to send `{ type: 'error', payload: { code: 'FORBIDDEN', message: '...' } }` on membership-check authorization failure instead of returning silently.
- Manually test direct PostgREST access to the new `group_members_read` policy using the anon key plus a valid JWT to confirm the self-referencing membership check does not recurse or error and returns the expected rows.

### Phase 2: Data Integrity & Database (Critical + High DB)

_Fixes H5–H11, M14–M16, H8–H9_

- Migration: add indexes on `group_members.user_id` and `channels.group_id`
- Migration: change `messages.sender_id` to `ON DELETE SET NULL`
- Migration: add `messages.seq` column (fix type drift)
- Migration: add `NOT NULL` to `messages.channel_id`
- Migration: add `updated_at` auto-update triggers
- Migration: add `ON CONFLICT` to `handle_new_user()` trigger
- Fix `message_reactions` INSERT policy (add membership check) ❌
- Enable email confirmation and strengthen password policy in `config.toml` ❌

### Phase 3: PWA Fixes (Critical + High PWA)

_Fixes C6, H12–H15, M17–M20_

- Change POST caching strategy from `NetworkFirst` to `NetworkOnly`
- Add `NetworkFirst` runtime caching for API GET requests
- Add `setCatchHandler` offline fallback
- Switch to `registerType: 'prompt'` with update toast UI
- Create proper maskable icon asset
- Fix SW `postMessage` listener to use `navigator.serviceWorker`
- Add `beforeinstallprompt` handling
- Add `navigator.storage.persist()` call
- Add `pushsubscriptionchange` event handler

### Phase 4: Frontend Modernization

_Fixes H16–H17, M11–M13_

- Fix `onAuthStateChange` subscription leak
- Replace `!` assertions with `?? undefined`
- Migrate 4 modals to `defineModel()`
- Migrate template refs to `useTemplateRef()` (8+ components)
- Switch messages array to `shallowRef`
- Fix/remove stale `App.spec.ts` test
- Extract duplicated user-mapping helper in `authStore`

### Phase 5: Backend Hardening

_Fixes H1, H3, H4, H20, M7–M9_

- Fix push sender: use `Promise.allSettled` instead of `Promise.all`
- Fix N+1 query in `GET /groups` (batch member fetch)
- Refactor module-level Maps into a connection state class
- Add graceful shutdown (`SIGTERM`/`SIGINT` handlers)
- Replace `console.log` with Pino logger throughout `chat.ts`
- ✅ Switch to JWKS-based local JWT verification (M7)
- Make group creation transactional (Supabase RPC)

### Phase 6: iOS App Improvements

_Fixes C7–C8, H21–H23, M21–M23_

- Move API keys to `.xcconfig` excluded from version control
- Fix `SocketStream` concurrency (actor or lock)
- Replace `fatalError()` with throwing init or validation
- Extract computed `some View` properties into standalone View structs
- Replace `DispatchQueue.main.async` with `@MainActor`
- Fix `onDisappear` premature cleanup
- Add retry logic to `APIClient`
- Create configured `URLSession`

### Phase 7: Infrastructure & Config Cleanup

_Fixes H18–H19, M24–M28_

- Add security headers to Caddyfiles
- Parameterize hardcoded IP/paths with env vars
- Update `tsconfig.base.json` (target, remove dead decorator config)
- Remove ghost `pocketbase` dependency; move hoisted deps to correct packages
- Widen tilde-locked dependency specifiers, upgrade outdated packages
