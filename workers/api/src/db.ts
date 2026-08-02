/**
 * D1 helpers, typed rows, URL canonicalization, slug/uid generators.
 */

// ---------------------------------------------------------------------------
// Row types (match migrations)
// ---------------------------------------------------------------------------

export type SourceType = "article" | "video" | "audio" | "image";
export type ReportReason = "copyright_concern" | "other";

export interface UserRow {
  id: number;
  auth_user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_seen_at: string | null;
}

export interface AnnotationRow {
  id: number;
  slug: string;
  author_user_id: number | null;
  anonymous: number;
  source_url: string;
  canonical_source_key: string;
  source_type: SourceType;
  source_title: string | null;
  source_author: string | null;
  domain: string | null;
  clip_text: string | null;
  clip_start_seconds: number | null;
  clip_end_seconds: number | null;
  transcript_excerpt: string | null;
  media_asset_key: string | null;
  screenshot_key: string | null;
  commentary: string;
  parent_id: number | null;
  thread_root_id: number | null;
  fair_use_basis: string | null;
  up_count: number;
  down_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string | null;
}

export interface CommentRow {
  id: number;
  annotation_id: number;
  user_id: number | null;
  body: string;
  parent_id: number | null;
  created_at: string;
  deleted_at: string | null;
}

export interface VoteRow {
  annotation_id: number;
  user_id: number;
  value: -1 | 1;
}

export interface ReportRow {
  id: number;
  annotation_id: number;
  reporter_user_id: number | null;
  reason: ReportReason;
  body: string | null;
  resolved: number;
  created_at: string;
}

export interface CanonicalSourceRow {
  key: string;
  url: string;
  type: string | null;
  domain: string | null;
  title: string | null;
  author: string | null;
  first_seen_at: string;
  annotation_count: number;
}

export interface ScreenshotUploadRow {
  id: string;
  r2_key: string;
  user_id: number;
  used: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Base32 (Crockford-ish lowercase, no I/L/O/U for readability)
// ---------------------------------------------------------------------------

const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

/** 6-char base32 uid from crypto.getRandomValues */
export function randomBase32(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += BASE32_ALPHABET[bytes[i]! % 32];
  }
  return out;
}

/**
 * Slugify a title for URL paths. Truncates at a word boundary
 * (last '-' before maxLen) so we never cut mid-word ("foundati-").
 */
export function slugify(input: string, maxLen = 48): string {
  let s = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (s.length > maxLen) {
    s = s.slice(0, maxLen);
    const lastDash = s.lastIndexOf("-");
    if (lastDash > 0) {
      s = s.slice(0, lastDash);
    }
    s = s.replace(/-+$/g, "");
  }

  return s || "clip";
}

/**
 * Insert with UNIQUE slug/handle retry loop.
 * `build` produces the value; `insert` returns true on success, false on UNIQUE collision.
 */
export async function withUniqueRetry(
  build: () => string,
  insert: (value: string) => Promise<boolean>,
  maxAttempts = 8
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const value = build();
    const ok = await insert(value);
    if (ok) return value;
  }
  throw new Error("unique_retry_exhausted");
}

// ---------------------------------------------------------------------------
// canonicalizeUrl → canonical_source_key
// lowercase host+path, strip utm_*/fbclid/gclid, drop fragment, trim trailing slash
// ---------------------------------------------------------------------------

const STRIP_PARAMS = /^(utm_|fbclid$|gclid$)/i;

/**
 * Produce a stable canonical_source_key from a URL string.
 * Format: host + path (no scheme, no fragment, tracking params stripped, no trailing slash).
 */
export function canonicalizeUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error("invalid_url");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("invalid_url");
  }

  const host = parsed.hostname.toLowerCase();
  let path = parsed.pathname || "/";
  // collapse // and trim trailing slash (except root)
  path = path.replace(/\/+/g, "/");
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  path = path.toLowerCase();

  const kept = new URLSearchParams();
  // sort for stability
  const entries: [string, string][] = [];
  parsed.searchParams.forEach((value, key) => {
    if (STRIP_PARAMS.test(key) || key.toLowerCase().startsWith("utm_")) return;
    entries.push([key.toLowerCase(), value]);
  });
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  for (const [k, v] of entries) kept.append(k, v);

  const qs = kept.toString();
  return qs ? `${host}${path}?${qs}` : `${host}${path}`;
}

export function domainFromUrl(url: string): string {
  try {
    return new URL(url.trim()).hostname.toLowerCase();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// App user bridge
// ---------------------------------------------------------------------------

export async function getUserByAuthId(
  db: D1Database,
  authUserId: string
): Promise<UserRow | null> {
  return db
    .prepare("SELECT * FROM users WHERE auth_user_id = ?")
    .bind(authUserId)
    .first<UserRow>();
}

export async function getUserById(
  db: D1Database,
  id: number
): Promise<UserRow | null> {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
}

export async function getUserByHandle(
  db: D1Database,
  handle: string
): Promise<UserRow | null> {
  return db
    .prepare("SELECT * FROM users WHERE handle = ?")
    .bind(handle)
    .first<UserRow>();
}

/**
 * Ensure app `users` row exists for a Better Auth user.
 * handle = slugify(displayName || email-prefix) + rand4, deduped on UNIQUE.
 */
export async function ensureAppUser(
  db: D1Database,
  authUser: { id: string; name?: string | null; email?: string | null; image?: string | null }
): Promise<UserRow> {
  const existing = await getUserByAuthId(db, authUser.id);
  if (existing) {
    // best-effort profile refresh
    if (authUser.name || authUser.image) {
      await db
        .prepare(
          `UPDATE users SET
             display_name = COALESCE(?, display_name),
             avatar_url = COALESCE(?, avatar_url),
             last_seen_at = datetime('now')
           WHERE id = ?`
        )
        .bind(authUser.name ?? null, authUser.image ?? null, existing.id)
        .run();
    } else {
      await db
        .prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?")
        .bind(existing.id)
        .run();
    }
    return (await getUserById(db, existing.id))!;
  }

  const emailPrefix = (authUser.email || "user").split("@")[0] || "user";
  const base = slugify(authUser.name || emailPrefix, 24);

  const handle = await withUniqueRetry(
    () => `${base}${randomBase32(4)}`,
    async (candidate) => {
      try {
        await db
          .prepare(
            `INSERT INTO users (auth_user_id, handle, display_name, avatar_url, last_seen_at)
             VALUES (?, ?, ?, ?, datetime('now'))`
          )
          .bind(
            authUser.id,
            candidate,
            authUser.name || emailPrefix,
            authUser.image ?? null
          )
          .run();
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/UNIQUE|unique/i.test(msg)) return false;
        throw err;
      }
    }
  );

  const row = await getUserByAuthId(db, authUser.id);
  if (!row) throw new Error(`failed to create app user for ${authUser.id} (${handle})`);
  return row;
}

export async function getAnnotationBySlug(
  db: D1Database,
  slug: string
): Promise<AnnotationRow | null> {
  return db
    .prepare("SELECT * FROM annotations WHERE slug = ?")
    .bind(slug)
    .first<AnnotationRow>();
}

export async function getAnnotationById(
  db: D1Database,
  id: number
): Promise<AnnotationRow | null> {
  return db
    .prepare("SELECT * FROM annotations WHERE id = ?")
    .bind(id)
    .first<AnnotationRow>();
}

/** Resolve annotation by numeric id or slug. */
export async function resolveAnnotation(
  db: D1Database,
  idOrSlug: string
): Promise<AnnotationRow | null> {
  if (/^\d+$/.test(idOrSlug)) {
    return getAnnotationById(db, Number(idOrSlug));
  }
  return getAnnotationBySlug(db, idOrSlug);
}

export async function insertAnnotationSlug(
  db: D1Database,
  buildSlug: () => string,
  insertWithSlug: (slug: string) => Promise<D1Result>
): Promise<{ slug: string; id: number }> {
  for (let i = 0; i < 8; i++) {
    const slug = buildSlug();
    try {
      const result = await insertWithSlug(slug);
      return { slug, id: Number(result.meta.last_row_id) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/UNIQUE|unique/i.test(msg)) continue;
      throw err;
    }
  }
  throw new Error("slug_retry_exhausted");
}

export async function upsertCanonicalSource(
  db: D1Database,
  opts: {
    key: string;
    url: string;
    type: string;
    domain: string;
    title?: string | null;
    author?: string | null;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO canonical_sources (key, url, type, domain, title, author, annotation_count)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET
         annotation_count = annotation_count + 1,
         title = COALESCE(excluded.title, canonical_sources.title),
         author = COALESCE(excluded.author, canonical_sources.author),
         type = COALESCE(excluded.type, canonical_sources.type)`
    )
    .bind(
      opts.key,
      opts.url,
      opts.type,
      opts.domain,
      opts.title ?? null,
      opts.author ?? null
    )
    .run();
}
