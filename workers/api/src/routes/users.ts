import { Hono } from "hono";
import type { Env } from "../env";
import type { AppVariables } from "../middleware";
import { getUserByHandle } from "../db";
import { FEED_SELECT, mapFeedRow } from "./feed";

export const userRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

userRoutes.get("/users/:handle", async (c) => {
  const handle = c.req.param("handle");
  const user = await getUserByHandle(c.env.DB, handle);
  if (!user) return c.json({ error: "not_found" }, 404);

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS c FROM annotations
     WHERE author_user_id = ? AND anonymous = 0 AND parent_id IS NULL`
  )
    .bind(user.id)
    .first<{ c: number }>();

  return c.json({
    profile: {
      handle: user.handle,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      annotation_count: countRow?.c ?? 0,
    },
  });
});

userRoutes.get("/users/:handle/annotations", async (c) => {
  const handle = c.req.param("handle");
  const user = await getUserByHandle(c.env.DB, handle);
  if (!user) return c.json({ error: "not_found" }, 404);

  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") || "20", 10) || 20));
  const offset = Math.max(0, parseInt(c.req.query("offset") || "0", 10) || 0);

  const { results } = await c.env.DB.prepare(
    `${FEED_SELECT}
     WHERE a.author_user_id = ? AND a.anonymous = 0 AND a.parent_id IS NULL
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(user.id, limit, offset)
    .all();

  return c.json({
    items: (results ?? []).map((r) => mapFeedRow(r as Record<string, unknown>)),
    limit,
    offset,
  });
});
