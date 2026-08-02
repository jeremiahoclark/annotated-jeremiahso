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
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-card)] border border-outline-variant/20 bg-black">
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
