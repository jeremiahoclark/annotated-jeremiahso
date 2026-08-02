/**
 * YouTube URL detection + timedtext captions probe (CACHE KV 24h).
 */

const YT_WATCH = /(?:youtube\.com\/watch\?.*v=|youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{6,})/i;
const YT_EMBED = /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/i;

export function extractYoutubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{6,}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/")[2];
        return id && /^[a-zA-Z0-9_-]{6,}$/.test(id) ? id : null;
      }
      if (u.pathname.startsWith("/embed/")) {
        const id = u.pathname.split("/")[2];
        return id && /^[a-zA-Z0-9_-]{6,}$/.test(id) ? id : null;
      }
      const v = u.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{6,}$/.test(v)) return v;
    }
  } catch {
    /* fall through */
  }
  const m = url.match(YT_WATCH) || url.match(YT_EMBED);
  return m?.[1] ?? null;
}

export async function probeYoutubeCaptions(
  videoId: string,
  cache: KVNamespace,
  timeoutMs = 3000
): Promise<boolean> {
  const cacheKey = `yt:captions:${videoId}`;
  try {
    const cached = await cache.get(cacheKey);
    if (cached === "1") return true;
    if (cached === "0") return false;
  } catch {
    /* allow */
  }

  let available = false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(videoId)}`,
      { signal: controller.signal }
    );
    if (res.ok) {
      const text = await res.text();
      // Non-empty track list XML
      available =
        text.includes("<track") ||
        text.includes("lang_code") ||
        (text.length > 50 && !text.includes("error"));
    }
  } catch {
    available = false;
  } finally {
    clearTimeout(timer);
  }

  try {
    await cache.put(cacheKey, available ? "1" : "0", {
      expirationTtl: 86400,
    });
  } catch {
    /* ignore */
  }
  return available;
}

export type MediaType = "video" | "audio" | "article" | "image" | "unknown";

export function detectMediaType(url: string): MediaType {
  if (extractYoutubeVideoId(url)) return "video";
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    if (/\.(mp4|webm|mov|m4v)(\?|$)/.test(path)) return "video";
    if (/\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/.test(path)) return "audio";
    if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/.test(path)) return "image";
    return "article";
  } catch {
    return "unknown";
  }
}
