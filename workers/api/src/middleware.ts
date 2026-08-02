/**
 * Auth middleware: bearer token OR cookie session → appUser on context.
 */
import type { Context, MiddlewareHandler, Next } from "hono";
import type { Env } from "./env";
import { getAuth } from "./auth";
import {
  ensureAppUser,
  getUserByAuthId,
  type UserRow,
} from "./db";

export type AppVariables = {
  appUser: UserRow | null;
  authEmail: string | null;
  authUserId: string | null;
  isAdmin: boolean;
};

export type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;

function parseAdminEmails(env: Env): Set<string> {
  const raw = env.ADMIN_EMAILS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function sessionFromBearer(
  request: Request,
  env: Env
): Promise<{ userId: string; email: string } | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const row = await env.DB.prepare(
    `SELECT s.userId, u.email FROM "session" s
     JOIN "user" u ON u.id = s.userId
     WHERE s.token = ? AND s.expiresAt > datetime('now')`
  )
    .bind(token)
    .first<{ userId: string; email: string }>();

  return row ?? null;
}

async function sessionFromCookie(
  request: Request,
  env: Env
): Promise<{ userId: string; email: string; name?: string; image?: string | null } | null> {
  if (!request.headers.get("Cookie")) return null;
  try {
    const auth = getAuth(env);
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return null;
    return {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    };
  } catch (err) {
    console.error("Cookie session lookup failed", err);
    return null;
  }
}

/**
 * Resolve auth from Bearer OR cookie; attach appUser (lazy-provisioned).
 * Does not fail if unauthenticated — sets nulls.
 */
export async function authenticateRequest(
  c: AppContext
): Promise<UserRow | null> {
  const env = c.env;
  let session =
    (await sessionFromBearer(c.req.raw, env)) ||
    (await sessionFromCookie(c.req.raw, env));

  if (!session) {
    c.set("appUser", null);
    c.set("authEmail", null);
    c.set("authUserId", null);
    c.set("isAdmin", false);
    return null;
  }

  let appUser = await getUserByAuthId(env.DB, session.userId);
  if (!appUser) {
    // Fetch name/image from auth user if cookie path didn't supply them
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
      appUser = await ensureAppUser(env.DB, authUser);
    }
  }

  const email = session.email.toLowerCase();
  const isAdmin = parseAdminEmails(env).has(email);

  c.set("appUser", appUser);
  c.set("authEmail", session.email);
  c.set("authUserId", session.userId);
  c.set("isAdmin", isAdmin);

  return appUser;
}

/** Middleware: always run auth resolution (optional auth). */
export const optionalAuth: MiddlewareHandler<{
  Bindings: Env;
  Variables: AppVariables;
}> = async (c, next) => {
  await authenticateRequest(c as AppContext);
  await next();
};

/**
 * Require authenticated app user. Returns 401 { error } if missing.
 */
export async function requireAuth(c: AppContext): Promise<UserRow | Response> {
  let user = c.get("appUser");
  if (!user) {
    user = await authenticateRequest(c);
  }
  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }
  return user;
}

/**
 * Require admin (ADMIN_EMAILS allowlist). 401 unauthed, 403 not admin.
 */
export async function requireAdmin(
  c: AppContext
): Promise<UserRow | Response> {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  if (!c.get("isAdmin")) {
    return c.json({ error: "Admin access required" }, 403);
  }
  return user;
}

/** Hono helper: early-return if requireAuth failed. */
export function isErrorResponse(
  value: UserRow | Response
): value is Response {
  return value instanceof Response;
}
