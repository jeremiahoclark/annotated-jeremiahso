# Annotated

A fair-use media annotation network: right-click any media on the web, clip it (video ≤90s, audio ≤90s, text ≤100 words), write commentary, and share it to a public feed with votes, comments, and leaderboards.

**Clip it. Comment on it. Back it up.**

Product name: **Annotated**. Built for the All-In Podcast "Annotated" contest vision — commentary-first clips that always credit the original source.

## Architecture

```
annotated-jeremiahso/
├── workers/api/       # annotated-api  — Hono + D1 + R2 + KV + Better Auth
├── workers/app/       # annotated-app  — SPA assets + /api/* service binding proxy
├── frontend/          # Vite + React 19 + Tailwind v4 SPA
├── migrations/        # D1 SQL migrations (wrangler d1 migrations apply)
├── extension/         # Chrome MV3 (scaffold; build in extension phase)
└── docs/              # SPEC, fair-use policy, auth setup
```

```
Browser ──► annotated-app (Workers Assets SPA)
               │
               ├── /api/*  ──service binding──► annotated-api
               │                                   ├── D1 annotated-db
               │                                   ├── R2 annotated-media
               │                                   └── KV RATE_LIMIT / CACHE
               └── static  ── ASSETS (frontend/dist)
```

- **Two-Worker split:** API owns data, secrets, and business logic; app owns static assets and same-origin `/api/*` proxy (no CORS).
- **Auth:** Better Auth (Google, X/Twitter OAuth2 PKCE, magic link via Resend).
- **Fair use:** server-side enforcement of clip limits, required commentary, and always-link-back.

## Quickstart

```bash
# Node 22
nvm use

# Install all workspaces
npm install

# Local secrets for the API worker
cp workers/api/.dev.vars.example workers/api/.dev.vars
# fill BETTER_AUTH_SECRET, OAuth, Resend as needed

# Apply D1 migrations (local)
npm run db:migrate:local

# Dev API (port 8787)
npm run dev

# Dev frontend (port 3000, proxies /api → :8787)
npm run dev -w annotated-web

# Typecheck / build / test
npx tsc --noEmit -p workers/api
npx tsc --noEmit -p frontend
npm run build
npm test
```

Deploy (after secrets + remote migrations):

```bash
npm run db:migrate:remote
npm run deploy
```

See [docs/auth-setup.md](docs/auth-setup.md) for OAuth and Resend setup, [docs/FAIR-USE.md](docs/FAIR-USE.md) for the public fair-use policy, and [docs/SPEC.md](docs/SPEC.md) for the full product contract.

### Fonts

Production should self-host **Newsreader**, **Outfit**, and **JetBrains Mono** under `frontend/public/fonts/`. Local/dev uses Google Fonts links in `index.html` for speed.

## License

MIT © 2026 Jeremiah O. Clark
