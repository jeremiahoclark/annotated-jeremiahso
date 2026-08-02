import { Hono } from "hono";
import type { Env } from "../env";
import type { AppVariables, AppContext } from "../middleware";
import { requireAdmin, isErrorResponse } from "../middleware";

export const adminRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

adminRoutes.get("/admin/reports", async (c) => {
  const admin = await requireAdmin(c as AppContext);
  if (isErrorResponse(admin)) return admin;

  const resolved = c.req.query("resolved");
  let sql = `
    SELECT r.id, r.annotation_id, r.reporter_user_id, r.reason, r.body,
           r.resolved, r.created_at, a.slug AS annotation_slug
    FROM reports r
    JOIN annotations a ON a.id = r.annotation_id
  `;
  if (resolved === "0" || resolved === "1") {
    sql += ` WHERE r.resolved = ${resolved === "1" ? 1 : 0}`;
  }
  sql += " ORDER BY r.created_at DESC LIMIT 100";

  const { results } = await c.env.DB.prepare(sql).all();
  return c.json({ reports: results ?? [] });
});

adminRoutes.post("/admin/reports/:id/resolve", async (c) => {
  const admin = await requireAdmin(c as AppContext);
  if (isErrorResponse(admin)) return admin;

  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) {
    return c.json({ error: "not_found" }, 404);
  }

  const existing = await c.env.DB.prepare(
    "SELECT id FROM reports WHERE id = ?"
  )
    .bind(id)
    .first();
  if (!existing) return c.json({ error: "not_found" }, 404);

  await c.env.DB.prepare("UPDATE reports SET resolved = 1 WHERE id = ?")
    .bind(id)
    .run();

  return c.json({ ok: true, id });
});
