/**
 * Better Auth v1 — kysely-d1, Google + Twitter (built-in), magic link, bearer, admin.
 * Uses better-auth@1.6.x API (twitter social provider is built-in).
 */
import { betterAuth } from "better-auth";
import { bearer, admin, magicLink } from "better-auth/plugins";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import type { Env } from "./env";
import { ensureAppUser } from "./db";

/** Last magic-link URL for dev JSON responses (no mailer). */
let lastDevMagicLink: string | null = null;

const MAILER_FROM = "Annotated <hey@jeremiah.so>";
const MAILER_REPLY_TO = "hey@jeremiah.so";
const MAILER_TIMEOUT_MS = 8_000;

export function takeDevMagicLink(): string | null {
  const v = lastDevMagicLink;
  lastDevMagicLink = null;
  return v;
}

export function peekDevMagicLink(): string | null {
  return lastDevMagicLink;
}

function isDev(env: Env): boolean {
  return (env.ENVIRONMENT || "").toLowerCase() === "development";
}

function hasMailer(env: Env): boolean {
  return Boolean(env.MAILER && env.MAILER_SEND_TOKEN?.trim());
}

/**
 * Send via jeremiah-so-mailer Worker.
 * Logs failures; rethrows so magic-link sign-in surfaces the error.
 */
async function sendMailerEmail(
  env: Env,
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<void> {
  const token = env.MAILER_SEND_TOKEN!.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAILER_TIMEOUT_MS);
  try {
    const res = await env.MAILER!.fetch("https://mailer.internal/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        from: MAILER_FROM,
        subject,
        text,
        html,
        replyTo: MAILER_REPLY_TO,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Mailer send failed", res.status, body);
      throw new Error(`Mailer send failed: ${res.status}`);
    }
  } catch (err) {
    console.error("Mailer send error", err);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function resolveTrustedOrigins(env: Env): string[] {
  const origins = new Set<string>([
    "http://localhost:3000",
    "http://localhost:8787",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8787",
    "http://localhost:*",
    "http://127.0.0.1:*",
    "https://*.workers.dev",
  ]);
  // Allow any annotated workers.dev host patterns
  origins.add("https://annotated-app.*.workers.dev");
  origins.add("https://annotated-api.*.workers.dev");
  if (env.ENVIRONMENT === "development" || env.ENVIRONMENT === "test") {
    origins.add("http://localhost:*");
  }
  return [...origins];
}

function useSecureCookies(env: Env): boolean {
  const e = (env.ENVIRONMENT || "").toLowerCase();
  return e === "production";
}

let _auth: ReturnType<typeof buildAuth> | null = null;
let _lastDb: D1Database | null = null;

export function buildAuth(env: Env) {
  const db = new Kysely({ dialect: new D1Dialect({ database: env.DB }) });

  const socialProviders: Record<string, { clientId: string; clientSecret: string; overrideUserInfoOnSignIn?: boolean }> = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      overrideUserInfoOnSignIn: true,
    };
  }
  // Built-in X/Twitter OAuth2 provider (better-auth social-providers/twitter)
  if (env.TWITTER_CLIENT_ID && env.TWITTER_CLIENT_SECRET) {
    socialProviders.twitter = {
      clientId: env.TWITTER_CLIENT_ID,
      clientSecret: env.TWITTER_CLIENT_SECRET,
      overrideUserInfoOnSignIn: true,
    };
  }

  return betterAuth({
    database: {
      db,
      type: "sqlite",
    },
    secret: env.BETTER_AUTH_SECRET || "dev-insecure-secret-change-me",
    basePath: "/api/auth",
    baseURL: {
      allowedHosts: [
        "localhost:*",
        "127.0.0.1:*",
        "*.workers.dev",
      ],
      fallback: "http://localhost:8787",
      protocol: "auto" as const,
    },
    trustedOrigins: resolveTrustedOrigins(env),
    socialProviders,
    plugins: [
      bearer(),
      admin(),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          lastDevMagicLink = url;
          if (hasMailer(env)) {
            const html = `<p>Click to sign in:</p><p><a href="${url}">${url}</a></p>`;
            const text = `Click to sign in: ${url}`;
            await sendMailerEmail(env, email, "Sign in to Annotated", text, html);
          } else {
            console.log("[magic-link]", email, url);
          }
        },
      }),
    ],
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "user", input: false },
      },
    },
    advanced: {
      useSecureCookies: useSecureCookies(env),
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
      },
      trustedProxyHeaders: true,
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            try {
              await ensureAppUser(env.DB, {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
              });
            } catch (err) {
              console.error("ensureAppUser after user.create failed", err);
            }
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            try {
              // Reconcile bridge row on every new session
              const authUser = await env.DB.prepare(
                `SELECT id, name, email, image FROM "user" WHERE id = ?`
              )
                .bind(session.userId)
                .first<{
                  id: string;
                  name: string;
                  email: string;
                  image: string | null;
                }>();
              if (authUser) {
                await ensureAppUser(env.DB, authUser);
              }
            } catch (err) {
              console.error("ensureAppUser after session.create failed", err);
            }
          },
        },
      },
    },
  });
}

export function getAuth(env: Env) {
  if (_auth && _lastDb === env.DB) return _auth;
  _auth = buildAuth(env);
  _lastDb = env.DB;
  return _auth;
}

export function resetAuthCache(): void {
  _auth = null;
  _lastDb = null;
}

/**
 * Handle Better Auth routes; in development without mailer, attach dev_link
 * to magic-link JSON responses.
 */
export async function handleAuthRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const auth = getAuth(env);
  const res = await auth.handler(request);

  const url = new URL(request.url);
  const isMagicLinkPost =
    request.method === "POST" &&
    url.pathname.replace(/\/$/, "").endsWith("/sign-in/magic-link");

  if (isMagicLinkPost && isDev(env) && !hasMailer(env) && res.ok) {
    const link = takeDevMagicLink();
    if (link) {
      try {
        const data = (await res.clone().json()) as Record<string, unknown>;
        const body = JSON.stringify({ ...data, dev_link: link });
        const headers = new Headers(res.headers);
        headers.set("Content-Type", "application/json");
        headers.set("Cache-Control", "no-store");
        return new Response(body, { status: res.status, headers });
      } catch {
        /* fall through */
      }
    }
  }

  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", "no-store");
  return out;
}
