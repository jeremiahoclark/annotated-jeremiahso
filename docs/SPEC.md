# Annotated — Master Build Spec (for annotated-jeremiahso)

Source of truth for the build. Product vision transcribed from Jay's demo video
(the All-In Podcast "Annotated" contest segment, ~/Downloads/annotated-demo-DoaSls8l.mp4,
transcript via OpenSuperWhisper ggml-large-v3-turbo).

## One-liner

A fair-use media annotation network: right-click any media on the web, clip it
(video ≤90s, audio ≤90s, text ≤100 words), write commentary, and share it to a
public feed with votes, comments, and leaderboards. "Clip it, comment on it, back it up."

Product name: **Annotated**. Tagline on landing: "Clip it. Comment on it. Back it up."

## Hard product rules (fair use, enforce in code — server side validation, never trust client)

1. Text clips: max 100 words per clip. To say more, the user threads another clip
   (parent_id). Show thread chains in UI.
2. Audio/video clips: max 90 seconds (clip_end - clip_start ≤ 90, both ≥ 0).
3. Commentary REQUIRED on every top-level annotation (min 10 non-whitespace chars).
4. Always link back + credit: store source_url, canonical_source_key, domain,
   source_title, source_author when available. Every annotation page shows a
   prominent "View original" link with domain.
5. Never re-host full media. v1 renders A/V as BOUNDED embeds (start/end enforced
   in the player UI), plus a low-res screenshot captured client-side and stored in R2,
   plus a transcript window for videos with captions (best effort).
   Seam for v2 true ripping (240p downgrade, ffmpeg container job writing R2 assets):
   `annotations.media_asset_key` column + R2 bucket exist from day one.
6. Every annotation has a "copyright concern" flag button → reports table
   (reason enum: copyright_concern, other) → admin sees flagged list.
   This is the "fair use claim / I believe you're stealing" determination hook.
7. Anonymous annotation allowed (anonymous=1, hides author; author_user_id still
   recorded server-side for abuse control).

## Architecture (inspired by trendingblack; all on Cloudflare)

Monorepo `annotated-jeremiahso`:

```
annotated-jeremiahso/
  docs/SPEC.md, docs/FAIR-USE.md, docs/auth-setup.md
  workers/api/        # backend Worker `annotated-api` (TS, Hono)
    src/index.ts, src/routes/*, src/auth.ts, src/db.ts, src/util/*
    wrangler.toml (D1, R2, KV, assets-none, account_id 04b10da5b2c496a790ebb3f60bfe1b18)
  workers/app/        # app shell Worker `annotated-app` — serves frontend SPA as assets,
                      # proxies /api/* to annotated-api via service binding (trendingblack pattern)
    src/index.ts, wrangler.toml
  migrations/         # numbered D1 migrations 0001…; applytracker via `wrangler d1 migrations apply`
  frontend/           # Vite + React 19 + Tailwind v4 SPA (landing + feed + annotation pages)
    src/pages (Landing, Feed, AnnotationPage, UserStream, Leaderboard)
    src/components/ui/*, src/lib/api.ts, src/lib/types.ts (API CONTRACT)
    src/index.css     # design tokens @theme
  extension/          # Chrome MV3
    manifest.json, icons/, dist/ (built)
    src/sidepanel/ (React via vite build), src/extractors.ts, src/background.ts, src/auth.ts
  package.json (root: scripts dev/deploy/migrate/test), README.md, AGENTS.md
```

- two-Worker split: api Worker owns D1/R2/KV/secrets; app Worker owns static assets
  + service binding `API` → same-origin /api/* proxy, no CORS.
- D1 `annotated-db`; R2 bucket `annotated-media` (screenshots, future ripped assets);
  KV namespaces `RATE_LIMIT`, `CACHE`.
- Router: Hono (NOT the trendingblack hand-rolled if-chain).
- Auth: Better Auth (kysely-d1 adapter), basePath /api/auth. Providers:
  Google (`google`), X/Twitter (`twitter`), email magic link (`magicLink` plugin;
  sender via `EMAIL_FROM` + `RESEND_API_KEY` secret; when RESEND_API_KEY absent,
  log the link and return it in JSON only when ENVIRONMENT=development).
  Secrets: BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID/SECRET, TWITTER_CLIENT_ID/SECRET
  (OAuth2 PKCE), RESEND_API_KEY. Vars: ENVIRONMENT.
  docs/auth-setup.md documents exact console setup steps for Google + X + resend.
  Session: Better Auth cookie sessions for web; bearer plugin for extension
  (POST /api/auth/extension/token: web session → one-time bearer mint for the
  extension's launchWebAuthFlow round trip). Admin: env var ADMIN_EMAILS allowlist
  checked in middleware + user.role via admin plugin.
- Identity bridge like trendingblack: Better Auth "user" (TEXT ids) ↔ numeric
  app `users(id INTEGER)` via hooks + lazy reconcile (`ensureAppUser`).
  Handle: auto-generated from display name (slug + dedupe suffix), user-editable later (v1.1).

## D1 schema (migrations/)

0001_initial.sql:
- sources NOT needed as registry; keep `canonical_sources` cache table:
  (key TEXT PK = canonicalized URL, url, type, domain, title, author, first_seen_at, annotation_count)
- annotations: id INTEGER PK AUTOINCREMENT, slug TEXT UNIQUE NOT NULL,
  author_user_id INTEGER REFERENCES users(id) (NULL = deleted user),
  anonymous INTEGER NOT NULL DEFAULT 0,
  source_url TEXT NOT NULL, canonical_source_key TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('article','video','audio','image')),
  source_title TEXT, source_author TEXT, domain TEXT,
  clip_text TEXT (≤100 words, validated), clip_start_seconds REAL, clip_end_seconds REAL,
  transcript_excerpt TEXT, media_asset_key TEXT (v2 ripping seam), screenshot_key TEXT,
  commentary TEXT NOT NULL (min 10 chars validated),
  parent_id INTEGER REFERENCES annotations(id), thread_root_id INTEGER,
  fair_use_basis TEXT DEFAULT 'commentary-criticism',
  up_count INTEGER DEFAULT 0, down_count INTEGER DEFAULT 0, comment_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT.
  Indexes: (created_at), (canonical_source_key), (author_user_id), (parent_id), (thread_root_id).
  CHECK on clip: for video/audio clip_end_seconds - clip_start_seconds BETWEEN >0 AND 90.
- comments: id PK, annotation_id REFERENCES, user_id, body TEXT (max 1000 chars), parent_id,
  created_at, deleted_at NULL.
- votes: annotation_id, user_id, value INTEGER CHECK(value IN (-1, 1)),
  PRIMARY KEY (annotation_id, user_id). Upsert recomputes counts transactionally.
- reports: id PK, annotation_id, reporter_user_id NULL, reason TEXT CHECK(reason IN ('copyright_concern','other')),
  body TEXT, resolved INTEGER DEFAULT 0, created_at.
0002_better_auth.sql: Better Auth tables "user","session","account","verification"
  + app `users` bridge table (id INTEGER PK, auth_user_id TEXT UNIQUE, handle TEXT UNIQUE,
  display_name, avatar_url, reaction_count, last_seen_at).
0003_admin_seed.sql skipped — admin via env allowlist.

## API endpoints (backend Worker, JSON)

Public:
- GET  /api/feed?limit&offset&sort=hot|new → annotations w/ author/display info, source, counts.
  `hot` = trendingblack-style freshness×engagement CTE (votes×3 + comments×4, 24h half-life).
- GET  /api/annotations/:slug → full landing payload: annotation, parent chain (thread),
  replies (children), original source info, bounded-embed data (video_id/start/end for youtube),
  transcript_excerpt, screenshot url (R2 public-served via /media/:key route on api worker).
- GET  /api/users/:handle → profile + their public annotations (excluding their anonymous ones).
- GET  /api/users/:handle/annotations (paginated).
- GET  /api/leaderboard?window=7d|30d|all → most-annotated sources (group canonical_source_key)
  + top annotators (by annotations + net votes). "10 most annotated pieces of media."
- GET  /api/annotations/:id/comments (threaded), GET /api/users/:handle
- GET  /api/health
- GET  /media/:key → R2 object stream (public read of screenshots; cacheable).

Authed (Bearer or cookie):
- POST /api/annotations {source_url, source_type, source_title?, source_author?,
  clip_text?, clip_start_seconds?, clip_end_seconds?, transcript_excerpt?,
  commentary, anonymous?, parent_id?, screenshot_upload_id?}
  → validates word/seconds/commentary rules + source fetch enrichment best-effort
  (og:title/description scrape via HTMLRewriter), generates intelligent slug:
  `/<handle>/<slugified-source-title-or-domain>-<rand4>`, answer 201 {slug, url}.
- POST /api/screenshots (multipart or base64 JSON) → stores in R2 under
  shots/<annotation-temp>/<rand>.png, returns upload_id; annotation create references it.
  Cap 2MB, PNG/JPEG only, strip EXIF (store as-is; canvas capture has no EXIF).
- POST /api/annotations/:id/comments {body, parent_id?} (rate limit 20/hour/user via KV)
- POST /api/annotations/:id/vote {value: 1|-1|0} → upsert + recounts.
- POST /api/annotations/:id/report {reason, body?} (also callable unauthed; reporter NULL).
- POST /api/media/prepare {url} → clipability probe for extension:
  {ok, type, domain, title, author, canonical_key, youtube_video_id?, duration_estimate?,
   captions_available?, reason? } (YouTube detect via regex; timedtext list probe best-effort,
   cache 24h in CACHE KV).
- GET  /api/me → current user {id, handle, display_name, avatar_url}.
- POST /api/auth/extension/token (cookie session → {token}) for extension bearer mint.
Admin (ADMIN_EMAILS): GET /api/admin/reports, POST /api/admin/reports/:id/resolve,
  POST /api/admin/annotations/:id/remove (sets deleted_at; v1.1 soft delete — SKIP for v1,
  use reports list only).

## YouTube clip rendering (v1, no re-hosting)

- Embed via youtube-nocookie iframe with `start=`, `end=` params; player stops at clip end
  (end param supported). Surround with transcript window (captions fetched at create time
  via youtube timedtext API best-effort; store only the caption lines intersecting the clip
  window and cap stored excerpt at 100 words) + screenshot card.
- On annotation page show assertion line: "Approx. Ns clip · shared under fair-use
  commentary/criticism · original: <domain>".

## Chrome extension (MV3) — name "Annotated"

permissions: ["activeTab", "scripting", "storage", "contextMenus", "sidePanel", "notifications", "identity"]
host_permissions: ["<all_urls>"] is AVOIDED; activeTab covers user-invoked actions.
Action click → opens side panel (feed when online).
Context menus (created in background SW):
- "Clip this video/audio → Annotated" on contexts video+audio:
  executeScript extractor: finds the media element under the click (or the largest playing
  one): {src/currentSrc, duration, currentTime, isYouTubeEmbed, og tags, title}.
  Extractor asks composer: start = media.currentTime (editable), end = start+90 cap.
  For YouTube PAGES: parse player via window.ytInitialPlayerResponse (best effort) or DOM
  player; video id from URL; currentTime from <video>.
- "Clip selection as text → Annotated" on selection context: selectionText, ≤100 words
  (truncate + warn), page metadata.
- "Clip this page" on page context: screenshot + page metadata (article-type flow).
Composer opens in the side panel (sidePanel.open) pre-filled:
  clip preview (times for A/V, truncated text, screenshot thumbnail),
  commentary textarea (required, counter), anonymous toggle, Fair Use checkbox
  [x] "My commentary adds criticism/commentary and this clip/link credits the source".
  Publish → POST /api/annotations → success notification with link (click opens landing page).
Screenshot capture: tabs.captureVisibleTab (user-gesture scoped, activeTab) → downscale
client-side to max 640px wide JPEG q0.7 (canvas) → upload → reference in annotation.
Side panel tabs: "Compose" | "Feed". Feed tab: online check (navigator.onLine AND
fetch /api/health ok) → iframe to web FEED_URL with `?embed=1` (FEED_URL baked via
import.meta.env at build; e.g. https://annotated-app.<sub>.workers.dev). Offline →
"You're offline. Reconnect to see the feed." Right-click context items work offline?
No — publish requires online; disable publish with reason when offline.
Auth: side panel "Sign in" → chrome.identity.launchWebAuthFlow to WEB_AUTH_URL
  (app worker /auth/extension start page that runs Better Auth OAuth/magic-link and ends
  at /auth/extension/complete which POSTs bearer token back via redirect URL param scheme
  → background stores tb_token bearer). Mirror trendingblack's token-in-storage pattern
  but provider-agnostic.

## Design system: "Ember Editorial" (Obsidian Editorial, orange instead of gold)

- background #0E0E10, surface #131313, containers #201F1F/#2A2A2A/#353534 (tonal elevation, NO drop shadows)
- primary #FFC07A (soft orange-tinted light) / primaryContainer #FF7A00;
  signature gradient 135° #FFC07A → #FF7A00; text selection = #FF7A00 bg + black text
- secondary #A7FFD5/#00E676, tertiary #ABEBFF/#00D7FE, error #FFB4A1/#FF3D00
- onSurface #E5E2E1, onSurfaceVariant #D5C4AB, outlineVariant #4A3A2A (warmer bronze to suit orange)
- Typography: Newsreader (headlines serif), Outfit (body), JetBrains Mono (metrics)
- 24px card radius, glass header (backdrop-blur), comment/story panel dims non-focused cards 50%
- TrendingBlack DESIGN.MD at /Users/kingj/dev/firstmate/projects/trendingblack/DESIGN.MD
  is the reference; port tokens 1:1 with the orange swap.

## Frontend (web)

Pages: Landing (hero: tagline, what-it-does 3-step, "Get the Extension" CTA, live
sampling of latest annotations), Feed (hot/new toggle, infinite scroll20/page),
Annotation (slug page: media/excerpt + commentary + votes + comments + thread chain +
"View original" + report button), User stream, Leaderboard, auth pages.
React 19, Tailwind v4 tokens in index.css @theme, motion for card animations,
@tanstack/react-virtual for feed virtualization (trendingblack pattern).
Feed is public (no auth wall); engagement prompts auth modal ("Join the conversation").

## Contracts produced by scaffold agent (agents B/C build against them)

- frontend/src/lib/types.ts — all API request/response types.
- frontend/src/lib/api.ts — typed fetch client with base URL resolution (same-origin /api).
- docs/SPEC.md — this spec committed into the repo.
- docs/FAIR-USE.md — public-facing fair use policy (cite the 4 factors, our limits).
- Design tokens in frontend/src/index.css @theme + shared extension CSS import.

## Verification bar (Captain owns the final call; agents run what they can)

- npm test (workers vitest pool) green; frontend vitest green; typecheck all packages.
- wrangler deploy dry + real deploy of api + app on workers.dev subdomains:
  annotated-api.jeremiahoclark.workers.dev, annotated-app.jeremiahoclark.workers.dev.
- D1 migrations applied remote; R2/KV created by orchestrator before deploy.
- Extension loads unpacked (documented), manifest v3 validates (chrome-extension:// lint via
  agents) — final visual check via browser automation by orchestrator.
- README.md: vision, screenshots section (placeholder), local dev, deploy, extension install,
  auth setup link. AGENTS.md: build/test/deploy commands + fair-use invariants.
- License: MIT. Public repo, no secrets committed (audit with grep for keys before push).

## Contest notes (from transcript, context-only)

- $5k contest, two bounties, Jay dreams of this existing; best case the builder gets
  hired/partnered. Extra demo examples that must work: NYT article + YouTube page.
- X login matters (X is where the clips will be argued about). Keep X OAuth first-class.

## Out of scope v1

- True 240p server-side ripping (seam exists), personalization, email digests.
- Podcast ingest specifics (RSS audio ranges) — audio-type clips from any page suffice.
- Paywall bypass for NYT etc.: text clip uses user-selected DOM text only.
