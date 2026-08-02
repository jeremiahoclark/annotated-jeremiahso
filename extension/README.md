# Annotated — Chrome extension (MV3)

Right-click any media on the web, clip it (video/audio ≤90s, text ≤100 words), write commentary, and publish to the Annotated feed under fair use.

## Load unpacked

1. Build:

   ```bash
   npm install --prefix extension
   npm run build --prefix extension
   ```

2. Chrome → `chrome://extensions` → enable **Developer mode**.
3. **Load unpacked** → select **`extension/dist/`** (not the `extension/` parent).
4. Pin Annotated; click the action to open the side panel (Compose / Feed).

## Override app origin

Default API / feed / auth origin:

`https://annotated-app.jeremiahoclark.workers.dev`

```bash
VITE_APP_ORIGIN=https://your-app.example npm run build --prefix extension
```

This bakes `APP_ORIGIN` into the bundle and sets `host_permissions` to that origin. Update Google/X OAuth redirect allowlists for the extension’s `chrome.identity.getRedirectURL()` as well.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | typecheck + sidepanel + background SW + static copy + validate |
| `npm run validate` | assert `dist/manifest.json` is loadable MV3 |
| `npm test` | pure helpers (word count, clip window, YouTube id) |
| `npm run typecheck` | `tsc --noEmit` |

## Permissions rationale (store review)

| Permission | Why |
|------------|-----|
| `activeTab` | Temporary access to the tab the user is interacting with (context menu / action) so we can extract media metadata and capture a screenshot — without `<all_urls>`. |
| `scripting` | Inject the self-contained media extractor into the active tab on user gesture. |
| `storage` | Persist bearer session (`local`) and in-flight `clipDraft` (`session`). |
| `contextMenus` | “Clip this video/audio”, “Clip selection as text”, “Clip this page”, “Open Annotated feed”. |
| `sidePanel` | Composer + feed UI; open on action click and after a clip capture. |
| `notifications` | Optional success toast with the public annotation URL after publish. |
| `identity` | `launchWebAuthFlow` for Google / X / email magic-link round-trip; stores bearer only. |

**Host permission:** only the configured app origin (default `https://annotated-app.jeremiahoclark.workers.dev/*`) for `/api/*`, auth pages, and the feed iframe. **No `<all_urls>`.**

## Auth flow

1. Side panel → Google / X → `chrome.identity.launchWebAuthFlow` to  
   `{APP_ORIGIN}/auth/extension/start?provider=…&redirect_uri=…`
2. Web app completes Better Auth; redirects to  
   `…/auth/extension/complete?token=…` (or extension redirect URL with `token`).
3. Extension stores `{ token, user }` in `chrome.storage.local` and sends  
   `Authorization: Bearer <token>` on API calls.
4. Email: magic link via `POST /api/auth/sign-in/magic-link`; user checks inbox.

## Context menu ids

| Id | Title | Contexts |
|----|-------|----------|
| `clip-av` | Clip this video/audio | video, audio |
| `clip-selection` | Clip selection as text | selection |
| `clip-page` | Clip this page | page, image |
| `open-feed` | Open Annotated feed | page |

## Fair-use limits (client + server)

- A/V window: `0 < end − start ≤ 90` seconds  
- Text: ≤ 100 words  
- Commentary: ≥ 10 non-whitespace characters  
- Always store source URL; never re-host full media  

## Layout

```
extension/
  dist/                 # load unpacked here
  src/
    background.ts       # service worker
    extractors/media-extractor.js  # plain JS for executeScript files[]
    sidepanel/          # React 19 compose + feed
    lib/                # api-client, auth, helpers
  scripts/
    copy-static.mjs
    validate-dist.mjs
  tests/
```
