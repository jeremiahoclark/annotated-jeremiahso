import { youtubeEmbedUrl } from "@/utils/youtube";

interface YouTubeEmbedProps {
  videoId: string;
  start?: number | null;
  end?: number | null;
  title?: string;
}

export function YouTubeEmbed({
  videoId,
  start,
  end,
  title = "YouTube clip",
}: YouTubeEmbedProps) {
  // Cap height (~420px) so commentary lead stays above the fold at 1280×633
  return (
    <div
      className="relative mx-auto aspect-video w-full max-h-[420px] overflow-hidden rounded-[var(--radius-card)] border border-outline-variant/20 bg-black"
      style={{ maxWidth: "min(100%, 746px)" }}
    >
      <iframe
        src={youtubeEmbedUrl(videoId, start, end)}
        title={title}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
