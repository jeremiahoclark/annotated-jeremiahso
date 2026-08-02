import { Hono } from "hono";
import type { Env } from "./env";

/**
 * annotated-api — Hono backend for the fair-use annotation network.
 *
 * TODO: auth (Better Auth + kysely-d1)
 * TODO: routes — feed, annotations CRUD, votes, comments, reports, media
 * TODO: fair-use validation (90s A/V, 100-word text, commentary required, link-back)
 * TODO: rate limits via RATE_LIMIT KV; prepare/media cache via CACHE KV
 * TODO: R2 screenshot upload + /media/:key
 */

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => {
  return c.json({ ok: true });
});

// TODO: mount /api/auth/* (Better Auth handler)
// TODO: mount public + authed API routes

export default app;
