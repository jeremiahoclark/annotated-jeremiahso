/**
 * Pure helpers shared by side panel + unit tests.
 * Keep free of chrome.* so vitest can import them.
 */

/** Count words by whitespace split (empty → 0). */
export function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/** Non-whitespace character count for commentary min length. */
export function countNonWhitespace(text: string): number {
  return text.replace(/\s/g, "").length;
}

export type ClipWindowResult =
  | { ok: true; start: number; end: number; duration: number }
  | { ok: false; error: string };

/**
 * Validate A/V clip window: both ≥ 0, end > start, duration ≤ maxSeconds (default 90).
 */
export function validateClipWindow(
  start: number,
  end: number,
  maxSeconds = 90
): ClipWindowResult {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { ok: false, error: "Start and end must be numbers." };
  }
  if (start < 0 || end < 0) {
    return { ok: false, error: "Times must be ≥ 0." };
  }
  if (end <= start) {
    return { ok: false, error: "End must be after start." };
  }
  const duration = end - start;
  if (duration > maxSeconds) {
    return {
      ok: false,
      error: `Clip must be ≤ ${maxSeconds}s (currently ${duration.toFixed(1)}s).`,
    };
  }
  return { ok: true, start, end, duration };
}

/**
 * Extract YouTube video id from common URL shapes:
 * watch?v=, youtu.be/, /shorts/, /embed/
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const v = u.searchParams.get("v");
      if (v && /^[\w-]{6,}$/.test(v)) return v;
      const m = u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{6,})/);
      if (m) return m[1];
    }
    if (host.endsWith("youtube-nocookie.com")) {
      const m = u.pathname.match(/\/embed\/([\w-]{6,})/);
      if (m) return m[1];
    }
  } catch {
    /* fall through to regex */
  }
  const loose =
    /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/i.exec(
      url
    );
  return loose ? loose[1] : null;
}

export function isYouTubePageUrl(url: string): boolean {
  return extractYouTubeVideoId(url) != null;
}

/** Friendly messages for API validation codes. */
export function friendlyApiError(code?: string, fallback?: string): string {
  switch (code) {
    case "CLIP_TOO_LONG":
      return "Text clip is over 100 words. Shorten the selection.";
    case "CLIP_WINDOW_INVALID":
      return "A/V clip window must be greater than 0 and at most 90 seconds.";
    case "COMMENTARY_REQUIRED":
      return "Commentary needs at least 10 characters (not just spaces).";
    case "SOURCE_URL_INVALID":
      return "Source URL is invalid. Try clipping from an https page.";
    case "SOURCE_TYPE_INVALID":
      return "Unsupported source type.";
    case "PAYLOAD_TOO_LARGE":
      return "Screenshot is too large. Try again without a capture.";
    case "rate_limited":
      return "You’re posting too fast. Wait a bit and try again.";
    default:
      return fallback || "Something went wrong. Try again.";
  }
}
