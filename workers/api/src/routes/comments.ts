import { Hono } from "hono";
import type { Env } from "../env";
import type { AppVariables, AppContext } from "../middleware";
import { requireAuth, isErrorResponse, authenticateRequest } from "../middleware";
import { resolveAnnotation } from "../db";
import { validateCommentBody, ValidationError } from "../validation";
import { checkRateLimit, rateLimitedJson } from "../rate-limit";

export interface CommentNode {
  id: number;
  annotation_id: number;
  body: string;
  parent_id: number | null;
  created_at: string;
  deleted_at: string | null;
  author: {
    handle: string | null;
    display_name: string;
    avatar_url: string | null;
  };
  children: CommentNode[];
}

export async function buildCommentTree(
  db: D1Database,
  annotationId: number,
  cap = 50
): Promise<CommentNode[]> {
  const { results } = await db
    .prepare(
      `SELECT c.id, c.annotation_id, c.body, c.parent_id, c.created_at, c.deleted_at,
              c.user_id,
              u.handle, u.display_name, u.avatar_url
       FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.annotation_id = ?
       ORDER BY c.created_at ASC
       LIMIT ?`
    )
    .bind(annotationId, cap)
    .all<{
      id: number;
      annotation_id: number;
      body: string;
      parent_id: number | null;
      created_at: string;
      deleted_at: string | null;
      user_id: number | null;
      handle: string | null;
      display_name: string | null;
      avatar_url: string | null;
    }>();

  const nodes = new Map<number, CommentNode>();
  const roots: CommentNode[] = [];

  for (const r of results ?? []) {
    const node: CommentNode = {
      id: r.id,
      annotation_id: r.annotation_id,
      body: r.deleted_at ? "[deleted]" : r.body,
      parent_id: r.parent_id,
      created_at: r.created_at,
      deleted_at: r.deleted_at,
      author: {
        handle: r.handle,
        display_name: r.display_name || r.handle || "User",
        avatar_url: r.avatar_url,
      },
      children: [],
    };
    nodes.set(node.id, node);
  }

  for (const node of nodes.values()) {
    if (node.parent_id && nodes.has(node.parent_id)) {
      nodes.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export const commentRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

commentRoutes.get("/annotations/:id/comments", async (c) => {
  await authenticateRequest(c as AppContext);
  const ann = await resolveAnnotation(c.env.DB, c.req.param("id"));
  if (!ann) return c.json({ error: "not_found" }, 404);
  const comments = await buildCommentTree(c.env.DB, ann.id, 50);
  return c.json({ comments });
});

commentRoutes.post("/annotations/:id/comments", async (c) => {
  const user = await requireAuth(c as AppContext);
  if (isErrorResponse(user)) return user;

  const rl = await checkRateLimit(c.env, user.id, "annotations:comments");
  if (!rl.ok) return c.json(rateLimitedJson(), 429);

  const ann = await resolveAnnotation(c.env.DB, c.req.param("id"));
  if (!ann) return c.json({ error: "not_found" }, 404);

  let raw: { body?: unknown; parent_id?: unknown };
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON", code: "BODY_INVALID" }, 422);
  }

  let body: string;
  try {
    body = validateCommentBody(raw.body);
  } catch (e) {
    if (e instanceof ValidationError) return c.json(e.toJSON(), 422);
    throw e;
  }

  const parentId =
    typeof raw.parent_id === "number" && Number.isFinite(raw.parent_id)
      ? raw.parent_id
      : null;

  if (parentId != null) {
    const parent = await c.env.DB.prepare(
      "SELECT id FROM comments WHERE id = ? AND annotation_id = ?"
    )
      .bind(parentId, ann.id)
      .first();
    if (!parent) {
      return c.json(
        { error: "Parent comment not found", code: "COMMENT_INVALID" },
        422
      );
    }
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO comments (annotation_id, user_id, body, parent_id)
     VALUES (?, ?, ?, ?)`
  )
    .bind(ann.id, user.id, body, parentId)
    .run();

  await c.env.DB.prepare(
    "UPDATE annotations SET comment_count = comment_count + 1 WHERE id = ?"
  )
    .bind(ann.id)
    .run();

  return c.json(
    {
      id: Number(result.meta.last_row_id),
      annotation_id: ann.id,
      body,
      parent_id: parentId,
      created_at: new Date().toISOString(),
    },
    201
  );
});
