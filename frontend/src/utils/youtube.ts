/**
 * Extract a YouTube video id from common URL shapes.
 * watch?v=, youtu.be/, /shorts/, /embed/
 */
export function parseYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }
    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
      const liveIdx = parts.indexOf("live");
      if (liveIdx >= 0 && parts[liveIdx + 1]) return parts[liveIdx + 1];
    }
  } catch {
    return null;
  }
  return null;
}

export function youtubeEmbedUrl(
  videoId: string,
  start?: number | null,
  end?: number | null
): string {
  const params = new URLSearchParams({
    modestbranding: "1",
    rel: "0",
  });
  if (start != null && start > 0) params.set("start", String(Math.floor(start)));
  if (end != null && end > 0) params.set("end", String(Math.floor(end)));
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params}`;
}
