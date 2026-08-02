import { Hono } from "hono";
import type { Env } from "./env";
import type { AppVariables } from "./middleware";
import { optionalAuth } from "./middleware";
import { handleAuthRequest } from "./auth";
import { ValidationError } from "./validation";
import { feedRoutes } from "./routes/feed";
import { annotationRoutes } from "./routes/annotations";
import { commentRoutes } from "./routes/comments";
import { userRoutes } from "./routes/users";
import { leaderboardRoutes } from "./routes/leaderboard";
import { meRoutes } from "./routes/me";
import { extensionRoutes } from "./routes/extension";
import { screenshotRoutes } from "./routes/screenshots";
import { mediaRoutes, handleMediaGet } from "./routes/media";
import { adminRoutes } from "./routes/admin";

/**
 * annotated-api — Hono backend for the fair-use annotation network.
 * Auth: Better Auth (Google, Twitter, magic link, bearer).
 * Fair-use: 90s A/V, 100-word text, commentary required, link-back.
 */

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.onError((err, c) => {
  if (err instanceof ValidationError) {
    return c.json(err.toJSON(), 422);
  }
  console.error("Unhandled error", err);
  return c.json({ error: "internal_error" }, 500);
});

app.get("/api/health", (c) => c.json({ ok: true }));

// Better Auth handler (including magic-link dev_link)
app.all("/api/auth/*", async (c) => {
  // Extension token is a custom route — let it fall through via not matching
  // if path is exactly extension/token we skip (mounted below under /api)
  const path = new URL(c.req.url).pathname;
  if (path === "/api/auth/extension/token") {
    return extensionRoutes.fetch(c.req.raw, c.env, c.executionCtx);
  }
  return handleAuthRequest(c.req.raw, c.env);
});

// Optional auth resolution for all API routes
const api = new Hono<{ Bindings: Env; Variables: AppVariables }>();
api.use("*", optionalAuth);

api.route("/", feedRoutes);
api.route("/", annotationRoutes);
api.route("/", commentRoutes);
api.route("/", userRoutes);
api.route("/", leaderboardRoutes);
api.route("/", meRoutes);
api.route("/", extensionRoutes);
api.route("/", screenshotRoutes);
api.route("/", mediaRoutes);
api.route("/", adminRoutes);

app.route("/api", api);

// Public media stream (outside /api)
app.get("/media/*", async (c) => {
  const path = new URL(c.req.url).pathname;
  // /media/<key...> — key may contain slashes
  const key = decodeURIComponent(path.replace(/^\/media\//, ""));
  return handleMediaGet(c, key);
});

export default app;
