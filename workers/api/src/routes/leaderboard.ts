import { Hono } from "hono";
import type { Env } from "../env";
import type { AppVariables } from "../middleware";

export const leaderboardRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

function windowClause(window: string): string {
  if (window === "7d") return "AND a.created_at >= datetime('now', '-7 days')";
  if (window === "30d") return "AND a.created_at >= datetime('now', '-30 days')";
  return "";
}

leaderboardRoutes.get("/leaderboard", async (c) => {
  const window = c.req.query("window") || "7d";
  const w = window === "30d" || window === "all" ? window : "7d";
  const clause = windowClause(w);

  const { results: sources } = await c.env.DB.prepare(
    `SELECT a.canonical_source_key,
            a.domain,
            COALESCE(MAX(a.source_title), MAX(cs.title)) AS title,
            COUNT(*) AS count
     FROM annotations a
     LEFT JOIN canonical_sources cs ON cs.key = a.canonical_source_key
     WHERE a.parent_id IS NULL ${clause}
     GROUP BY a.canonical_source_key
     ORDER BY count DESC
     LIMIT 10`
  ).all();

  const { results: annotators } = await c.env.DB.prepare(
    `SELECT u.handle, u.display_name,
            COUNT(*) AS annotations,
            COALESCE(SUM(a.up_count - a.down_count), 0) AS net_votes
     FROM annotations a
     JOIN users u ON u.id = a.author_user_id
     WHERE a.parent_id IS NULL AND a.anonymous = 0 ${clause}
     GROUP BY u.id
     ORDER BY annotations DESC, net_votes DESC
     LIMIT 10`
  ).all();

  return c.json({
    window: w,
    most_annotated: (sources ?? []).map((r) => ({
      canonical_source_key: r.canonical_source_key as string,
      domain: (r.domain as string | null) ?? null,
      title: (r.title as string | null) ?? null,
      count: r.count as number,
    })),
    top_annotators: (annotators ?? []).map((r) => ({
      handle: r.handle as string,
      display_name: (r.display_name as string | null) ?? null,
      annotations: r.annotations as number,
      net_votes: r.net_votes as number,
    })),
  });
});
