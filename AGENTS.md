# AGENTS.md — Annotated

Commands and invariants for coding agents working in this monorepo.

## Commands

| Task | Command |
|------|---------|
| Install | `npm install` (root workspaces: frontend, workers/api, workers/app) |
| Dev API | `npm run dev` or `npm run dev -w annotated-api` (wrangler, :8787) |
| Dev web | `npm run dev -w annotated-web` (Vite :3000, proxies `/api` → :8787) |
| Build SPA | `npm run build` → `frontend/dist` |
| Typecheck API | `npx tsc --noEmit -p workers/api` |
| Typecheck web | `npx tsc --noEmit -p frontend` |
| Test | `npm test` (api vitest pool + frontend vitest) |
| D1 migrate local | `npm run db:migrate:local` |
| D1 migrate remote | `npm run db:migrate:remote` |
| Deploy | `npm run deploy` (api worker, then build SPA, then app worker) |

### Migrations

D1 migrations live in `/migrations` (repo root): `0001_initial`, `0002_better_auth`, `0003_screenshot_uploads`.

Apply **local** (dev / agent sanity — safe to run anytime):

```bash
npx wrangler d1 migrations apply annotated-db --local  -c workers/api/wrangler.toml
# or: npm run db:migrate:local
```

Apply **remote** (production D1 — orchestrator owns infra; do **not** run unless deploying):

```bash
npx wrangler d1 migrations apply annotated-db --remote -c workers/api/wrangler.toml
# or: npm run db:migrate:remote
```

Secrets for `annotated-api`: see `docs/auth-setup.md` and `workers/api/.dev.vars.example`.

API contracts: `docs/CONTRACTS.md`, `frontend/src/lib/types.ts`, `frontend/src/lib/api.ts`.

## Fair-use invariants (server-side; never trust the client)

1. **A/V clip window ≤ 90 seconds** — `clip_end_seconds - clip_start_seconds ≤ 90` (both ≥ 0). Enforced in SQL CHECK when both set, and in app validation.
2. **Text clips ≤ 100 words** — validated in application code (SQLite cannot count words reliably). Comment in migrations marks this as app-level.
3. **Commentary required** — every top-level annotation needs commentary with min 10 non-whitespace characters.
4. **Always link back** — store `source_url`, `canonical_source_key`, `domain`, and show a prominent “View original” link on every annotation page. Never re-host full media in v1 (bounded embeds + optional screenshot/transcript excerpt only).

Related: reports (`copyright_concern` / `other`), anonymous flag (author still recorded server-side).

## Package layout

- `workers/api` — Hono backend (`annotated-api`)
- `workers/app` — SPA shell + API proxy (`annotated-app`)
- `frontend` — React 19 SPA (`annotated-web`)
- `extension` — Chrome MV3 scaffold (build in extension phase)
- `docs/SPEC.md` — binding product spec

## Design

Ember Editorial tokens in `frontend/src/index.css` (`@theme`). No drop shadows; tonal elevation only. Orange primary (`#FF7A00` / `#FFC07A`), not gold.
