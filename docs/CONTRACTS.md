# API Contracts — Annotated

Binding shapes for frontend, extension, and backend agents. Source of truth for
request/response JSON. Implementation: `workers/api`. Client types:
`frontend/src/lib/types.ts` + `frontend/src/lib/api.ts`.

Base URL: **same-origin** `/api/*` (app worker proxies to api worker). No CORS.
Auth: cookie session (web) or `Authorization: Bearer <session.token>` (extension).

## Error envelope

| Status | Body | When |
|--------|------|------|
| 401 | `{ "error": "Authentication required" }` | Missing/invalid session |
| 403 | `{ "error": "Admin access required" }` | Non-admin on admin routes |
| 404 | `{ "error": "not_found" }` | Missing resource |
| 413 | `{ "error": "...", "code": "PAYLOAD_TOO_LARGE" }` | Screenshot > 2MB |
| 422 | `{ "error": "<msg>", "code": "<CODE>" }` | Validation (fair-use + input) |
| 429 | `{ "error": "rate_limited" }` | 30 req/hour/user/route (KV) |
| 500 | `{ "error": "internal_error" }` | Unhandled |

### Validation codes (422)

| Code | Rule |
|------|------|
| `CLIP_TOO_LONG` | `clip_text` word count > 100 |
| `CLIP_WINDOW_INVALID` | A/V window missing, ≤0, or >90s |
| `COMMENTARY_REQUIRED` | Commentary < 10 non-whitespace chars |
| `SOURCE_URL_INVALID` | Not absolute http(s) |
| `SOURCE_TYPE_INVALID` | Not article\|video\|audio\|image |
| `COMMENT_INVALID` | Comment body not 1–1000 chars |
| `REPORT_INVALID` | reason not copyright_concern\|other |
| `VOTE_INVALID` | value not 1\|-1\|0 |
| `PARENT_NOT_FOUND` | parent_id missing |
| `BODY_INVALID` | Malformed JSON / fields |

---

## Endpoints

### `GET /api/health`

**Res** `{ "ok": true }`

### `GET /api/feed?limit&offset&sort`

| Query | Default | Notes |
|-------|---------|-------|
| limit | 20 | max 50 |
| offset | 0 | |
| sort | `hot` | `hot` \| `new` |

**Res** `{ items: FeedItem[], limit, offset, sort }`

Top-level only (`parent_id IS NULL`). Anonymous → author display_name `"Anonymous"`, handle null.

**Hot score** (SQL):  
`0.6 * (0.5^(age_hours/24)) + 0.4 * (1 - exp(-(up*3 - down + comments*4)/10))`

### `GET /api/annotations/:slug`

**Res**
```json
{
  "annotation": { /* AnnotationDetail + parent, children, youtube_video_id */ },
  "comments": [ /* CommentNode tree, cap 50 */ ],
  "user_vote": 1 | -1 | 0 | null,
  "og": { "title": "...", "author": "..." }
}
```
404 `{ "error": "not_found" }`

### `POST /api/annotations` (auth)

**Req**
```json
{
  "source_url": "https://...",
  "source_type": "article|video|audio|image",
  "source_title": "optional",
  "source_author": "optional",
  "clip_text": "optional ≤100 words",
  "clip_start_seconds": 0,
  "clip_end_seconds": 90,
  "transcript_excerpt": "optional",
  "commentary": "required min 10 non-ws",
  "anonymous": false,
  "parent_id": null,
  "screenshot_upload_id": null
}
```
**Res 201** `{ "slug": "...", "url": "/a/<slug>" }`

Thread: `thread_root_id = parent.thread_root_id ?? parent.id` (self for top-level).  
OG enrich via `waitUntil` when `source_title` missing. Upserts `canonical_sources`.

### `GET /api/users/:handle`

**Res** `{ "profile": { handle, display_name, avatar_url, created_at, annotation_count } }`  
`annotation_count` = public non-anonymous top-level only.

### `GET /api/users/:handle/annotations?limit&offset`

Same feed item shape; own anonymous excluded.

### `GET /api/leaderboard?window=7d|30d|all`

**Res**
```json
{
  "window": "7d",
  "most_annotated": [{ "canonical_source_key", "domain", "title", "count" }],
  "top_annotators": [{ "handle", "display_name", "annotations", "net_votes" }]
}
```
Each list top 10.

### `GET /api/annotations/:id/comments`

**Res** `{ "comments": CommentNode[] }` (threaded, 50 cap)

### `POST /api/annotations/:id/comments` (auth)

**Req** `{ "body": "1..1000", "parent_id": null }`  
**Res 201** `{ id, annotation_id, body, parent_id, created_at }`  
Increments `comment_count`.

### `POST /api/annotations/:id/vote` (auth)

**Req** `{ "value": 1 | -1 | 0 }` (0 = clear)  
**Res** `{ up_count, down_count, user_vote }`  
UPSERT `votes`; recomputes counts.

### `POST /api/annotations/:id/report` (auth optional)

**Req** `{ "reason": "copyright_concern"|"other", "body": "optional" }`  
**Res 201** `{ id, ok: true }`  
Unauthed → `reporter_user_id` null.

### `GET /api/me` (auth)

**Res** `{ id, handle, display_name, avatar_url, created_at }`

### `POST /api/auth/extension/token` (cookie session)

Mints bearer for Chrome extension after web OAuth/magic-link.

**Res** `{ "token": "<session.token>", "user": { "handle", "display_name" } }`  
401 without cookie session.

Extension stores `token` and sends `Authorization: Bearer <token>` on API calls.

### Better Auth (`/api/auth/*`)

Standard Better Auth routes under `basePath` `/api/auth`:
- Google: `/api/auth/sign-in/social` provider `google`
- Twitter/X: provider `twitter` (built-in better-auth social provider)
- Magic link: `POST /api/auth/sign-in/magic-link` `{ email }`
  - With `MAILER_URL` + `MAILER_SEND_TOKEN`: email sent via jeremiah-so-mailer
  - Without + `ENVIRONMENT=development`: console.log + response includes `dev_link`

### `POST /api/screenshots` (auth)

**Req** `{ "data_base64": "...", "content_type": "image/png"|"image/jpeg" }`  
**Res 201** `{ "upload_id": "..." }`  
Max 2_000_000 decoded bytes → R2 `shots/<yyyy>/<rand16>.<ext>` + `screenshot_uploads` row.

### `GET /media/:key` (public, not under /api)

Streams R2 object. Content-Type from extension.  
`Cache-Control: public, max-age=31536000, immutable`. 404 when missing.

### `POST /api/media/prepare` (auth)

**Req** `{ "url": "https://..." }`  
**Res always 200**
```json
{
  "ok": true|false,
  "type": "video|audio|article|image|unknown",
  "domain": "...",
  "canonical_key": "...",
  "youtube_video_id": "optional",
  "captions_available": true,
  "reason": "only when ok:false"
}
```
YouTube detect: watch?v=, youtu.be/, /shorts/. Captions probe timedtext list, CACHE KV 24h.

### Admin (`ADMIN_EMAILS` comma list)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/admin/reports?resolved=0\|1` | Flagged list |
| POST | `/api/admin/reports/:id/resolve` | Sets resolved=1 |

---

## Rate limits

Mutating routes: **30 / hour / user / route** via KV key `rl:<userId>:<route>`, TTL 3600.  
On KV failure: allow (best-effort). Response 429 `{ "error": "rate_limited" }`.

---

## Public shapes (summary)

See `frontend/src/lib/types.ts` for full TypeScript: `FeedItem`, `AnnotationDetail`,
`Profile`, `Leaderboard`, `Me`, `CommentNode`, error envelope.
