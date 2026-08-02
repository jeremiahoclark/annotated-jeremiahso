import { Hono } from "hono";
import type { Env } from "../env";
import type { AppVariables } from "../middleware";

/**
 * Hot score (single SQL):
 * 0.6 * (0.5 ^ (age_hours / 24))
 * + 0.4 * (1 - exp(-(up_count*3 - down_count + comment_count*4) / 10))
 */
const HOT_ORDER = `
  (
    0.6 * pow(0.5, MAX(0.0, (julianday('now') - julianday(a.created_at)) * 24.0) / 24.0)
    + 0.4 * (1.0 - exp(-(a.up_count * 3.0 - a.down_count + a.comment_count * 4.0) / 10.0))
  ) DESC,
  a.created_at DESC
`;

const FEED_SELECT = `
  SELECT
    a.id, a.slug, a.anonymous, a.source_url, a.canonical_source_key, a.source_type,
    a.source_title, a.source_author, a.domain, a.clip_text, a.clip_start_seconds,
    a.clip_end_seconds, a.transcript_excerpt, a.screenshot_key, a.commentary,
    a.parent_id, a.thread_root_id, a.up_count, a.down_count, a.comment_count,
    a.created_at,
    CASE WHEN a.anonymous = 1 THEN NULL ELSE u.handle END AS author_handle,
    CASE WHEN a.anonymous = 1 THEN 'Anonymous' ELSE COALESCE(u.display_name, u.handle) END AS author_display_name,
    CASE WHEN a.anonymous = 1 THEN NULL ELSE u.avatar_url END AS author_avatar_url
  FROM annotations a
  LEFT JOIN users u ON u.id = a.author_user_id
`;

export const feedRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

feedRoutes.get("/feed", async (c) => {
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") || "20", 10) || 20));
  const offset = Math.max(0, parseInt(c.req.query("offset") || "0", 10) || 0);
  const sort = c.req.query("sort") === "new" ? "new" : "hot";

  const order =
    sort === "new" ? "a.created_at DESC, a.id DESC" : HOT_ORDER;

  const { results } = await c.env.DB.prepare(
    `${FEED_SELECT}
     WHERE a.parent_id IS NULL
     ORDER BY ${order}
     LIMIT ? OFFSET ?`
  )
    .bind(limit, offset)
    .all();

  const items = (results ?? []).map(mapFeedRow);
  return c.json({ items, limit, offset, sort });
});

export function mapFeedRow(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    slug: row.slug as string,
    anonymous: row.anonymous === 1,
    source_url: row.source_url as string,
    canonical_source_key: row.canonical_source_key as string,
    source_type: row.source_type as string,
    source_title: (row.source_title as string | null) ?? null,
    source_author: (row.source_author as string | null) ?? null,
    domain: (row.domain as string | null) ?? null,
    clip_text: (row.clip_text as string | null) ?? null,
    clip_start_seconds: (row.clip_start_seconds as number | null) ?? null,
    clip_end_seconds: (row.clip_end_seconds as number | null) ?? null,
    transcript_excerpt: (row.transcript_excerpt as string | null) ?? null,
    screenshot_key: (row.screenshot_key as string | null) ?? null,
    commentary: row.commentary as string,
    parent_id: (row.parent_id as number | null) ?? null,
    thread_root_id: (row.thread_root_id as number | null) ?? null,
    up_count: (row.up_count as number) ?? 0,
    down_count: (row.down_count as number) ?? 0,
    comment_count: (row.comment_count as number) ?? 0,
    created_at: row.created_at as string,
    author: {
      handle: (row.author_handle as string | null) ?? null,
      display_name: (row.author_display_name as string) || "Anonymous",
      avatar_url: (row.author_avatar_url as string | null) ?? null,
    },
  };
}

export { FEED_SELECT, HOT_ORDER };
