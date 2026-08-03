# Auth setup — Annotated

Better Auth on `annotated-api` (`basePath` `/api/auth`). Providers: **Google**, **X (Twitter)**, **email magic link** (jeremiah-so-mailer).

Secrets live only in Wrangler secrets (remote) or `workers/api/.dev.vars` (local). Never commit secrets.

## 1. Google Cloud OAuth

### Web client (SPA + API)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create project (or pick one) → **Create credentials → OAuth client ID**.
3. Configure OAuth consent screen (External or Internal): app name **Annotated**, support email, authorized domains later.
4. Application type: **Web application**.
5. Authorized JavaScript origins (examples):
   - `http://localhost:3000`
   - `http://127.0.0.1:8787`
   - `https://annotated-app.<your-subdomain>.workers.dev`
6. Authorized redirect URIs (Better Auth Google callback):
   - `http://localhost:8787/api/auth/callback/google`
   - `http://127.0.0.1:8787/api/auth/callback/google`
   - `https://annotated-api.<your-subdomain>.workers.dev/api/auth/callback/google`
   - If the browser only hits the **app** origin (recommended same-origin proxy):  
     `https://annotated-app.<your-subdomain>.workers.dev/api/auth/callback/google`
7. Copy **Client ID** and **Client secret** → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

### Extension client (Chrome identity)

1. Create another OAuth client: type **Chrome extension** (or Web with extension redirect if you use `chrome.identity.launchWebAuthFlow`).
2. For `launchWebAuthFlow`, authorized redirect is the extension’s  
   `https://<extension-id>.chromiumapp.org/`  
   (id known after packing / loading unpacked and reading chrome://extensions).
3. You may reuse the web client only if redirect URIs include the extension callback path your flow uses; prefer a dedicated client for clarity.
4. Extension auth mints a bearer via `POST /api/auth/extension/token` after the web OAuth round-trip (see product spec).

## 2. X (Twitter) Developer OAuth 2.0 PKCE

1. Open [X Developer Portal](https://developer.x.com/) → Project & App.
2. Create/select app → **User authentication settings** → set up.
3. App permissions: **Read** (default is enough for sign-in).
4. Type of App: **Web App, Automated App or Bot** (confidential) or SPA-style with PKCE as required by Better Auth’s Twitter provider.
5. Callback / Redirect URI:
   - `http://localhost:8787/api/auth/callback/twitter`
   - `https://annotated-api.<your-subdomain>.workers.dev/api/auth/callback/twitter`
   - Same-origin app proxy equivalent if used in production.
6. Website URL: your app origin.
7. Enable **OAuth 2.0** with **PKCE**.
8. Copy **Client ID** and **Client Secret** → `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET`.

## 3. jeremiah-so-mailer (magic link email)

Magic-link email is sent via the **jeremiah-so-mailer** Cloudflare Worker (Cloudflare Email Routing). Mail goes out as **hey@jeremiah.so** from:

`https://jeremiah-so-mailer.jeremiahoclark.workers.dev`

1. **`MAILER_URL`** — mailer worker base URL. Set in `workers/api/wrangler.toml` `[vars]` (not a secret):

   ```toml
   MAILER_URL = "https://jeremiah-so-mailer.jeremiahoclark.workers.dev"
   ```

2. **`MAILER_SEND_TOKEN`** — mailer’s bearer token. Set as a Wrangler secret:

   ```bash
   npx wrangler secret put MAILER_SEND_TOKEN -c workers/api/wrangler.toml
   ```

3. Without `MAILER_URL` / `MAILER_SEND_TOKEN`, development may log the magic link and return it in JSON only when `ENVIRONMENT=development`.

From / reply-to are hardcoded in the API as `Annotated <hey@jeremiah.so>` / `hey@jeremiah.so` (the mailer’s verified sending address).

## 4. Better Auth secret

Generate a long random string (32+ bytes):

```bash
openssl rand -base64 32
```

→ `BETTER_AUTH_SECRET`.

## 5. Put secrets on `annotated-api` (remote)

From repo root (or `workers/api`):

```bash
cd workers/api

npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put TWITTER_CLIENT_ID
npx wrangler secret put TWITTER_CLIENT_SECRET
npx wrangler secret put MAILER_SEND_TOKEN
```

Optional vars (wrangler.toml `[vars]`, not secrets):

- `ENVIRONMENT` — `development` | `production` | `test`
- `ADMIN_EMAILS` — comma-separated allowlist for admin routes
- `MAILER_URL` — jeremiah-so-mailer worker base URL

## 6. Local dev (`.dev.vars`)

```bash
cp workers/api/.dev.vars.example workers/api/.dev.vars
```

Fill:

```
BETTER_AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
MAILER_URL=
MAILER_SEND_TOKEN=
```

`.dev.vars` is gitignored. Wrangler loads it automatically for `wrangler dev`.

Leave `MAILER_URL` / `MAILER_SEND_TOKEN` empty for local magic-link testing: with `ENVIRONMENT=development`, the API logs the link and returns `dev_link` in the JSON response.

## 7. Smoke check

```bash
npm run dev -w annotated-api
curl -s http://127.0.0.1:8787/api/health
# → {"ok":true}
```

Then exercise `/api/auth/*` after the auth module is implemented.
