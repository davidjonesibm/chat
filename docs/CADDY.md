# Serving the App with Caddy

This guide covers two local serving configurations using [Caddy](https://caddyserver.com/) as a reverse proxy / static file server.

## Prerequisites

- **Caddy** installed (`brew install caddy` on macOS)
- **pnpm** installed
- **`caddy trust` run once** — installs Caddy's local CA into your system keychain so `tls internal` certs are trusted by browsers on this machine

---

## Scenario 1 — Local Frontend + Deployed (Cloud) Backend

### When to use

Use this when you want to serve a locally built frontend against a **production or staging Supabase/backend deployment**. No local backend process is needed. Useful for testing frontend changes against real data without running a full local stack.

### How it works

Caddy serves only the built static SPA (`dist/apps/frontend`). The frontend is configured at build time with absolute URLs pointing to the deployed backend and Supabase project. All API and WebSocket traffic goes directly from the browser to the cloud — Caddy only handles the `index.html` and static asset responses.

```
Browser → https://192.168.86.20:8443
  └─ ALL requests → Caddy serves static files (dist/apps/frontend)
       API / WebSocket traffic → browser connects directly to cloud URLs (baked into the JS bundle)
```

### Steps

1. **Configure frontend environment variables** — create or update `apps/frontend/.env`:

   | Variable                    | Description                         | Example                        |
   | --------------------------- | ----------------------------------- | ------------------------------ |
   | `VITE_SUPABASE_URL`         | Your deployed Supabase project URL  | `https://abcdefgh.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE` | Supabase anon/publishable key       | `eyJhbGci...`                  |
   | `VITE_API_URL`              | Deployed backend REST base URL      | `https://api.yourapp.com`      |
   | `VITE_SOCKET_URL`           | Deployed backend WebSocket base URL | `wss://api.yourapp.com`        |
   | `VITE_GIPHY_API_KEY`        | Giphy API key                       | `abc123...`                    |

   > `VITE_API_URL` and `VITE_SOCKET_URL` must be set to absolute URLs pointing at your deployed backend. If left unset, the frontend defaults to `window.location.origin` and Caddy would need to proxy those routes (see Scenario 2).

2. **Build the frontend:**

   ```sh
   pnpm build:frontend
   ```

   Output lands in `dist/apps/frontend/`.

3. **Start Caddy** using the root `Caddyfile`:

   ```sh
   caddy run --config Caddyfile
   ```

4. **Access the app** at:

   ```
   https://192.168.86.20:8443
   ```

   The app is reachable from any device on your LAN at this URL.

---

## Scenario 2 — Local Frontend + Local Backend + Local Database

### When to use

Use this when you want a **fully local stack** — local Supabase, local Fastify backend, and a locally built frontend — all served through a single Caddy origin. Useful for full end-to-end development and testing without any cloud dependencies.

### How it works

Caddy acts as a unified gateway. All traffic enters at `https://192.168.86.20:8443`, and Caddy routes requests based on path prefix:

```
Browser → https://192.168.86.20:8443
  ├─ /api/*, /ws, /ws/*          → reverse_proxy localhost:3000  (Fastify)
  ├─ /rest/v1/*, /auth/v1/*,
  │  /storage/v1/*, /realtime/v1/*,
  │  /functions/v1/*              → reverse_proxy localhost:54321 (Supabase Kong)
  └─ everything else              → static files (dist/apps/frontend)
```

Because all traffic shares the same origin, `VITE_API_URL` and `VITE_SOCKET_URL` can be left **unset** — the frontend defaults to `window.location.origin` and Caddy's routing rules take care of the rest.

### Steps

1. **Configure frontend environment variables** — create or update `apps/frontend/.env`:

   | Variable                    | Description                                                | Example                      |
   | --------------------------- | ---------------------------------------------------------- | ---------------------------- |
   | `VITE_SUPABASE_URL`         | Local Caddy origin (Supabase routes proxied through Caddy) | `https://192.168.86.20:8443` |
   | `VITE_SUPABASE_PUBLISHABLE` | Local Supabase anon key (from `supabase status`)           | `eyJhbGci...`                |
   | `VITE_GIPHY_API_KEY`        | Giphy API key                                              | `abc123...`                  |

   > Leave `VITE_API_URL` and `VITE_SOCKET_URL` **unset** — the frontend will default to `window.location.origin` (`https://192.168.86.20:8443`) and Caddy will route `/api/*` and `/ws` to Fastify automatically.

2. **Configure backend environment variables** — create or update `apps/backend/.env`:

   | Variable            | Description                                              | Example                      |
   | ------------------- | -------------------------------------------------------- | ---------------------------- |
   | `SUPABASE_URL`      | Local Supabase URL                                       | `http://127.0.0.1:54321`     |
   | `SUPABASE_SECRET`   | Local Supabase service-role key (from `supabase status`) | `eyJhbGci...`                |
   | `CORS_ORIGIN`       | Allowed CORS origins                                     | `https://192.168.86.20:8443` |
   | `VAPID_PUBLIC_KEY`  | Web push VAPID public key                                | `BNJ3...`                    |
   | `VAPID_PRIVATE_KEY` | Web push VAPID private key                               | `abc123...`                  |
   | `VAPID_SUBJECT`     | VAPID contact URI                                        | `mailto:you@example.com`     |
   | `PORT`              | Fastify listen port (default: 3000)                      | `3000`                       |
   | `HOST`              | Fastify listen host (default: 0.0.0.0)                   | `0.0.0.0`                    |

3. **Start local Supabase:**

   ```sh
   pnpm dev:supabase
   ```

   This runs `supabase start` and brings up the local Supabase stack with Kong on port `54321`. Run `supabase status` to retrieve the local anon key and service-role key for the env files above.

4. **Start the local Fastify backend:**

   ```sh
   pnpm dev:backend
   ```

   Fastify starts on port `3000` (or `PORT` if set).

5. **Build the frontend:**

   ```sh
   pnpm build:frontend
   ```

   Output lands in `dist/apps/frontend/`.

6. **Start Caddy** using `Caddyfile.full-dev`:

   ```sh
   caddy run --config Caddyfile.full-dev
   ```

7. **Access the app** at:

   ```
   https://192.168.86.20:8443
   ```

   The app is reachable from any device on your LAN at this URL.

---

## Notes

- **Rebuilding after frontend changes:** Caddy serves the _built_ output, not the dev server. After making frontend changes, re-run `pnpm build:frontend` and reload the browser.
- **Reloading Caddy config:** If you edit a Caddyfile while Caddy is running, apply the change with `caddy reload --config <filename>` without a full restart.
- **Trusting the cert on other LAN devices:** `caddy trust` only installs the CA on the local machine. Other devices on your network will see a cert warning unless you manually install Caddy's root CA on them.
