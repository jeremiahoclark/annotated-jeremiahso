import { Hono } from "hono";
import type { Env } from "../env";
import type { AppVariables, AppContext } from "../middleware";
import { requireAuth, isErrorResponse } from "../middleware";
import { checkRateLimit, rateLimitedJson } from "../rate-limit";
import {
  canonicalizeUrl,
  domainFromUrl,
} from "../db";
import {
  detectMediaType,
  extractYoutubeVideoId,
  probeYoutubeCaptions,
} from "../youtube";

export const mediaRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

/** Public R2 stream — mounted at /media/* outside /api in index.ts */
export async function handleMediaGet(
  c: { env: Env; req: { path: string; param: (k: string) => string } },
  key: string
): Promise<Response> {
  if (!key || key.includes("..")) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const obj = await c.env.MEDIA.get(key);
  if (!obj) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ext = key.split(".").pop()?.toLowerCase();
  const typeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
  };
  const contentType =
    obj.httpMetadata?.contentType ||
    typeMap[ext || ""] ||
    "application/octet-stream";

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (obj.httpEtag) headers.set("ETag", obj.httpEtag);

  return new Response(obj.body, { headers });
}

mediaRoutes.post("/media/prepare", async (c) => {
  const user = await requireAuth(c as AppContext);
  if (isErrorResponse(user)) return user;

  const rl = await checkRateLimit(c.env, user.id, "media:prepare");
  if (!rl.ok) return c.json(rateLimitedJson(), 429);

  let body: { url?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({
      ok: false,
      type: "unknown" as const,
      domain: null,
      canonical_key: null,
      reason: "invalid_json",
    });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return c.json({
      ok: false,
      type: "unknown" as const,
      domain: null,
      canonical_key: null,
      reason: "url_required",
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return c.json({
      ok: false,
      type: "unknown" as const,
      domain: null,
      canonical_key: null,
      reason: "invalid_url",
    });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return c.json({
      ok: false,
      type: "unknown" as const,
      domain: parsed.hostname || null,
      canonical_key: null,
      reason: "unsupported_protocol",
    });
  }

  let canonical_key: string;
  try {
    canonical_key = canonicalizeUrl(url);
  } catch {
    return c.json({
      ok: false,
      type: "unknown" as const,
      domain: domainFromUrl(url) || null,
      canonical_key: null,
      reason: "canonicalize_failed",
    });
  }

  const domain = domainFromUrl(url);
  const type = detectMediaType(url);
  const youtube_video_id = extractYoutubeVideoId(url);

  let captions_available: boolean | undefined;
  if (youtube_video_id) {
    captions_available = await probeYoutubeCaptions(
      youtube_video_id,
      c.env.CACHE
    );
  }

  return c.json({
    ok: true,
    type,
    domain,
    canonical_key,
    youtube_video_id: youtube_video_id ?? undefined,
    captions_available,
  });
});
