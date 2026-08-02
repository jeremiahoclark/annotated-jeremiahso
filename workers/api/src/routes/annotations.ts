import { Hono } from "hono";
import type { Env } from "../env";
import type { AppVariables, AppContext } from "../middleware";
import {
  authenticateRequest,
  requireAuth,
  isErrorResponse,
} from "../middleware";
import {
  canonicalizeUrl,
  domainFromUrl,
  getAnnotationById,
  getAnnotationBySlug,
  insertAnnotationSlug,
  randomBase32,
  resolveAnnotation,
  slugify,
  upsertCanonicalSource,
  type AnnotationRow,
} from "../db";
import {
  validateCreateAnnotation,
  ValidationError,
} from "../validation";
import { checkRateLimit, rateLimitedJson } from "../rate-limit";
import { enrichAnnotationOg } from "../og";
import { extractYoutubeVideoId } from "../youtube";
import { mapFeedRow } from "./feed";
import { buildCommentTree } from "./comments";

export const annotationRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

function authorFields(row: AnnotationRow, handle: string | null, display: string | null, avatar: string | null) {
  if (row.anonymous) {
    return {
      handle: null as string | null,
      display_name: "Anonymous",
      avatar_url: null as string | null,
    };
  }
  return {
    handle,
    display_name: display || handle || "User",
    avatar_url: avatar,
  };
}

annotationRoutes.get("/annotations/:slug", async (c) => {
  await authenticateRequest(c as AppContext);
  const slug = c.req.param("slug");
  const row = await getAnnotationBySlug(c.env.DB, slug);
  if (!row) return c.json({ error: "not_found" }, 404);

  const author = row.author_user_id
    ? await c.env.DB.prepare(
        "SELECT handle, display_name, avatar_url FROM users WHERE id = ?"
      )
        .bind(row.author_user_id)
        .first<{ handle: string; display_name: string | null; avatar_url: string | null }>()
    : null;

  let parent: { slug: string; title_snippet: string } | null = null;
  if (row.parent_id) {
    const p = await getAnnotationById(c.env.DB, row.parent_id);
    if (p) {
      parent = {
        slug: p.slug,
        title_snippet: (p.source_title || p.commentary || "").slice(0, 120),
      };
    }
  }

  const { results: childRows } = await c.env.DB.prepare(
    `SELECT a.id, a.slug, a.anonymous, a.source_url, a.canonical_source_key, a.source_type,
            a.source_title, a.source_author, a.domain, a.clip_text, a.clip_start_seconds,
            a.clip_end_seconds, a.transcript_excerpt, a.screenshot_key, a.commentary,
            a.parent_id, a.thread_root_id, a.up_count, a.down_count, a.comment_count,
            a.created_at,
            CASE WHEN a.anonymous = 1 THEN NULL ELSE u.handle END AS author_handle,
            CASE WHEN a.anonymous = 1 THEN 'Anonymous' ELSE COALESCE(u.display_name, u.handle) END AS author_display_name,
            CASE WHEN a.anonymous = 1 THEN NULL ELSE u.avatar_url END AS author_avatar_url
     FROM annotations a
     LEFT JOIN users u ON u.id = a.author_user_id
     WHERE a.parent_id = ?
     ORDER BY a.created_at ASC
     LIMIT 50`
  )
    .bind(row.id)
    .all();

  const children = (childRows ?? []).map((r) => mapFeedRow(r as Record<string, unknown>));

  const comments = await buildCommentTree(c.env.DB, row.id, 50);

  let user_vote: 1 | -1 | 0 | null = null;
  const appUser = c.get("appUser");
  if (appUser) {
    const v = await c.env.DB.prepare(
      "SELECT value FROM votes WHERE annotation_id = ? AND user_id = ?"
    )
      .bind(row.id, appUser.id)
      .first<{ value: number }>();
    user_vote = v ? (v.value as 1 | -1) : 0;
  }

  const youtube_video_id =
    row.source_type === "video" ? extractYoutubeVideoId(row.source_url) : null;

  const annotation = {
    id: row.id,
    slug: row.slug,
    anonymous: row.anonymous === 1,
    source_url: row.source_url,
    canonical_source_key: row.canonical_source_key,
    source_type: row.source_type,
    source_title: row.source_title,
    source_author: row.source_author,
    domain: row.domain,
    clip_text: row.clip_text,
    clip_start_seconds: row.clip_start_seconds,
    clip_end_seconds: row.clip_end_seconds,
    transcript_excerpt: row.transcript_excerpt,
    screenshot_key: row.screenshot_key,
    media_asset_key: row.media_asset_key,
    commentary: row.commentary,
    parent_id: row.parent_id,
    thread_root_id: row.thread_root_id,
    fair_use_basis: row.fair_use_basis,
    up_count: row.up_count,
    down_count: row.down_count,
    comment_count: row.comment_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
    youtube_video_id,
    author: authorFields(
      row,
      author?.handle ?? null,
      author?.display_name ?? null,
      author?.avatar_url ?? null
    ),
    parent,
    children,
  };

  return c.json({
    annotation,
    comments,
    user_vote,
    og: {
      title: row.source_title || row.commentary.slice(0, 80),
      author: row.anonymous
        ? "Anonymous"
        : author?.display_name || author?.handle || "User",
    },
  });
});

annotationRoutes.post("/annotations", async (c) => {
  const user = await requireAuth(c as AppContext);
  if (isErrorResponse(user)) return user;

  const rl = await checkRateLimit(c.env, user.id, "annotations:create");
  if (!rl.ok) return c.json(rateLimitedJson(), 429);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body", code: "BODY_INVALID" }, 422);
  }

  let input;
  try {
    input = validateCreateAnnotation(body);
  } catch (e) {
    if (e instanceof ValidationError) {
      return c.json(e.toJSON(), 422);
    }
    throw e;
  }

  let parent: AnnotationRow | null = null;
  let threadRootId: number | null = null;
  if (input.parent_id != null) {
    parent = await getAnnotationById(c.env.DB, input.parent_id);
    if (!parent) {
      return c.json(
        { error: "Parent annotation not found", code: "PARENT_NOT_FOUND" },
        422
      );
    }
    threadRootId = parent.thread_root_id ?? parent.id;
  }

  let canonicalKey: string;
  try {
    canonicalKey = canonicalizeUrl(input.source_url);
  } catch {
    return c.json(
      { error: "source_url must be an absolute http(s) URL", code: "SOURCE_URL_INVALID" },
      422
    );
  }
  const domain = domainFromUrl(input.source_url);

  let screenshotKey: string | null = null;
  if (input.screenshot_upload_id) {
    const shot = await c.env.DB.prepare(
      "SELECT * FROM screenshot_uploads WHERE id = ? AND user_id = ? AND used = 0"
    )
      .bind(input.screenshot_upload_id, user.id)
      .first<{ id: string; r2_key: string }>();
    if (shot) {
      screenshotKey = shot.r2_key;
    }
  }

  const titlePart = slugify(
    input.source_title || domain || "clip",
    40
  );

  const { slug, id } = await insertAnnotationSlug(
    c.env.DB,
    () => `${titlePart}-${randomBase32(6)}`,
    async (s) => {
      return c.env.DB.prepare(
        `INSERT INTO annotations (
           slug, author_user_id, anonymous, source_url, canonical_source_key,
           source_type, source_title, source_author, domain, clip_text,
           clip_start_seconds, clip_end_seconds, transcript_excerpt, screenshot_key,
           commentary, parent_id, thread_root_id, fair_use_basis
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'commentary-criticism')`
      )
        .bind(
          s,
          user.id,
          input.anonymous ? 1 : 0,
          input.source_url,
          canonicalKey,
          input.source_type,
          input.source_title ?? null,
          input.source_author ?? null,
          domain,
          input.clip_text ?? null,
          input.clip_start_seconds ?? null,
          input.clip_end_seconds ?? null,
          input.transcript_excerpt ?? null,
          screenshotKey,
          input.commentary,
          input.parent_id ?? null,
          threadRootId
        )
        .run();
    }
  );

  // For top-level, thread_root_id should be self if null
  if (threadRootId == null) {
    await c.env.DB.prepare(
      "UPDATE annotations SET thread_root_id = ? WHERE id = ?"
    )
      .bind(id, id)
      .run();
  }

  await upsertCanonicalSource(c.env.DB, {
    key: canonicalKey,
    url: input.source_url,
    type: input.source_type,
    domain,
    title: input.source_title,
    author: input.source_author,
  });

  if (input.screenshot_upload_id && screenshotKey) {
    await c.env.DB.prepare(
      "UPDATE screenshot_uploads SET used = 1 WHERE id = ?"
    )
      .bind(input.screenshot_upload_id)
      .run();
  }

  // OG enrichment when title missing
  if (!input.source_title) {
    c.executionCtx.waitUntil(enrichAnnotationOg(c.env.DB, id, input.source_url));
  }

  return c.json({ slug, url: `/a/${slug}` }, 201);
});

// Vote
annotationRoutes.post("/annotations/:id/vote", async (c) => {
  const user = await requireAuth(c as AppContext);
  if (isErrorResponse(user)) return user;

  const rl = await checkRateLimit(c.env, user.id, "annotations:vote");
  if (!rl.ok) return c.json(rateLimitedJson(), 429);

  const ann = await resolveAnnotation(c.env.DB, c.req.param("id"));
  if (!ann) return c.json({ error: "not_found" }, 404);

  let body: { value?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON", code: "BODY_INVALID" }, 422);
  }

  const { validateVoteValue, ValidationError: VE } = await import("../validation");
  let value: 1 | -1 | 0;
  try {
    value = validateVoteValue(body.value);
  } catch (e) {
    if (e instanceof VE) return c.json(e.toJSON(), 422);
    throw e;
  }

  if (value === 0) {
    await c.env.DB.prepare(
      "DELETE FROM votes WHERE annotation_id = ? AND user_id = ?"
    )
      .bind(ann.id, user.id)
      .run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO votes (annotation_id, user_id, value) VALUES (?, ?, ?)
       ON CONFLICT(annotation_id, user_id) DO UPDATE SET value = excluded.value`
    )
      .bind(ann.id, user.id, value)
      .run();
  }

  // Recompute counts in batch
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE annotations SET up_count = (
         SELECT COUNT(*) FROM votes WHERE annotation_id = ? AND value = 1
       ) WHERE id = ?`
    ).bind(ann.id, ann.id),
    c.env.DB.prepare(
      `UPDATE annotations SET down_count = (
         SELECT COUNT(*) FROM votes WHERE annotation_id = ? AND value = -1
       ) WHERE id = ?`
    ).bind(ann.id, ann.id),
  ]);

  const updated = await getAnnotationById(c.env.DB, ann.id);
  return c.json({
    up_count: updated?.up_count ?? 0,
    down_count: updated?.down_count ?? 0,
    user_vote: value,
  });
});

// Report
annotationRoutes.post("/annotations/:id/report", async (c) => {
  await authenticateRequest(c as AppContext);
  const appUser = c.get("appUser");

  if (appUser) {
    const rl = await checkRateLimit(c.env, appUser.id, "annotations:report");
    if (!rl.ok) return c.json(rateLimitedJson(), 429);
  }

  const ann = await resolveAnnotation(c.env.DB, c.req.param("id"));
  if (!ann) return c.json({ error: "not_found" }, 404);

  let body: { reason?: unknown; body?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON", code: "BODY_INVALID" }, 422);
  }

  const { validateReportReason, ValidationError: VE } = await import(
    "../validation"
  );
  let reason;
  try {
    reason = validateReportReason(body.reason);
  } catch (e) {
    if (e instanceof VE) return c.json(e.toJSON(), 422);
    throw e;
  }

  const reportBody =
    typeof body.body === "string" ? body.body.slice(0, 2000) : null;

  const result = await c.env.DB.prepare(
    `INSERT INTO reports (annotation_id, reporter_user_id, reason, body)
     VALUES (?, ?, ?, ?)`
  )
    .bind(ann.id, appUser?.id ?? null, reason, reportBody)
    .run();

  return c.json(
    { id: Number(result.meta.last_row_id), ok: true },
    201
  );
});
