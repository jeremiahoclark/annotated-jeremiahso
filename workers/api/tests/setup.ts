/// <reference types="@cloudflare/vitest-pool-workers" />
import { env } from "cloudflare:test";

export async function resetDb(): Promise<void> {
  await env.DB.exec("DELETE FROM votes");
  await env.DB.exec("DELETE FROM reports");
  await env.DB.exec("DELETE FROM comments");
  await env.DB.exec("DELETE FROM screenshot_uploads");
  await env.DB.exec("DELETE FROM annotations");
  await env.DB.exec("DELETE FROM canonical_sources");
  await env.DB.exec("DELETE FROM users");
  await env.DB.exec(`DELETE FROM "session"`);
  await env.DB.exec(`DELETE FROM "account"`);
  await env.DB.exec(`DELETE FROM "verification"`);
  await env.DB.exec(`DELETE FROM "user"`);
  await env.DB.exec(
    "DELETE FROM sqlite_sequence WHERE name IN ('annotations','comments','reports','users')"
  );
}

export async function seedUser(opts?: {
  handle?: string;
  displayName?: string;
  authUserId?: string;
}): Promise<number> {
  const authUserId = opts?.authUserId ?? `auth-${Math.random().toString(36).slice(2)}`;
  const handle = opts?.handle ?? `user${Math.random().toString(36).slice(2, 6)}`;
  // Ensure better-auth user row exists for FK-free bridge
  await env.DB.prepare(
    `INSERT OR IGNORE INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
     VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`
  )
    .bind(authUserId, opts?.displayName ?? handle, `${handle}@example.com`)
    .run();

  const result = await env.DB.prepare(
    `INSERT INTO users (auth_user_id, handle, display_name)
     VALUES (?, ?, ?)`
  )
    .bind(authUserId, handle, opts?.displayName ?? handle)
    .run();
  return Number(result.meta.last_row_id);
}

export async function seedAnnotation(opts: {
  authorId: number;
  slug?: string;
  commentary?: string;
  anonymous?: boolean;
  parentId?: number | null;
  threadRootId?: number | null;
  sourceUrl?: string;
  sourceType?: string;
  upCount?: number;
  downCount?: number;
  commentCount?: number;
  createdAt?: string;
  clipStart?: number | null;
  clipEnd?: number | null;
}): Promise<{ id: number; slug: string }> {
  const slug = opts.slug ?? `slug-${Math.random().toString(36).slice(2, 8)}`;
  const sourceUrl = opts.sourceUrl ?? "https://example.com/article";
  const result = await env.DB.prepare(
    `INSERT INTO annotations (
       slug, author_user_id, anonymous, source_url, canonical_source_key,
       source_type, domain, commentary, parent_id, thread_root_id,
       up_count, down_count, comment_count, created_at,
       clip_start_seconds, clip_end_seconds
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?)`
  )
    .bind(
      slug,
      opts.authorId,
      opts.anonymous ? 1 : 0,
      sourceUrl,
      "example.com/article",
      opts.sourceType ?? "article",
      "example.com",
      opts.commentary ?? "This is solid commentary for fair use.",
      opts.parentId ?? null,
      opts.threadRootId ?? null,
      opts.upCount ?? 0,
      opts.downCount ?? 0,
      opts.commentCount ?? 0,
      opts.createdAt ?? null,
      opts.clipStart ?? null,
      opts.clipEnd ?? null
    )
    .run();
  const id = Number(result.meta.last_row_id);
  if (opts.threadRootId == null && opts.parentId == null) {
    await env.DB.prepare(
      "UPDATE annotations SET thread_root_id = ? WHERE id = ?"
    )
      .bind(id, id)
      .run();
  }
  return { id, slug };
}

/** Create a bearer session for a seeded user (by auth_user_id). */
export async function seedSession(
  authUserId: string,
  token = `tok-${Math.random().toString(36).slice(2)}`
): Promise<string> {
  const sid = `sess-${Math.random().toString(36).slice(2)}`;
  await env.DB.prepare(
    `INSERT INTO "session" (id, userId, token, expiresAt, createdAt, updatedAt)
     VALUES (?, ?, ?, datetime('now', '+7 days'), datetime('now'), datetime('now'))`
  )
    .bind(sid, authUserId, token)
    .run();
  return token;
}

export async function authUserIdForAppUser(appUserId: number): Promise<string> {
  const row = await env.DB.prepare("SELECT auth_user_id FROM users WHERE id = ?")
    .bind(appUserId)
    .first<{ auth_user_id: string }>();
  if (!row) throw new Error("user not found");
  return row.auth_user_id;
}
