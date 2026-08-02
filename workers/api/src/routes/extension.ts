import { Hono } from "hono";
import type { Env } from "../env";
import type { AppVariables } from "../middleware";
import { getAuth } from "../auth";
import { ensureAppUser, getUserByAuthId } from "../db";

/**
 * POST /api/auth/extension/token
 * Requires cookie session. Returns bearer session token for Chrome extension.
 */
export const extensionRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

extensionRoutes.post("/auth/extension/token", async (c) => {
  const cookie = c.req.header("Cookie");
  if (!cookie) {
    return c.json({ error: "Authentication required" }, 401);
  }

  try {
    const auth = getAuth(c.env);
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.session?.token || !session.user) {
      return c.json({ error: "Authentication required" }, 401);
    }

    let appUser = await getUserByAuthId(c.env.DB, session.user.id);
    if (!appUser) {
      appUser = await ensureAppUser(c.env.DB, {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      });
    }

    return c.json({
      token: session.session.token,
      user: {
        handle: appUser.handle,
        display_name: appUser.display_name,
      },
    });
  } catch (err) {
    console.error("extension token session failed", err);
    return c.json({ error: "Authentication required" }, 401);
  }
});
