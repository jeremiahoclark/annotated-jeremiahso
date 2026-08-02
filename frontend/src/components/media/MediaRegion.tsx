import type { AnnotationDetail } from "@/lib/types";
import { api } from "@/lib/api";
import { parseYouTubeVideoId } from "@/utils/youtube";
import { YouTubeEmbed } from "./YouTubeEmbed";
import { BoundedMedia } from "./BoundedMedia";
import { QuoteCard } from "./QuoteCard";

interface MediaRegionProps {
  annotation: AnnotationDetail;
}

export function MediaRegion({ annotation }: MediaRegionProps) {
  const type = (annotation.source_type || "").toLowerCase();
  const ytId =
    annotation.youtube_video_id ||
    parseYouTubeVideoId(annotation.source_url);

  if ((type === "video" || type === "audio") && ytId) {
    return (
      <YouTubeEmbed
        videoId={ytId}
        start={annotation.clip_start_seconds}
        end={annotation.clip_end_seconds}
        title={annotation.source_title || "Video clip"}
      />
    );
  }

  if (type === "video" || type === "audio") {
    // Direct media URL (if re-host key or absolute media URL)
    const mediaSrc = annotation.media_asset_key
      ? api.mediaUrl(annotation.media_asset_key)
      : annotation.source_url;
    if (mediaSrc && /^https?:\/\//i.test(mediaSrc)) {
      return (
        <BoundedMedia
          src={mediaSrc}
          kind={type === "audio" ? "audio" : "video"}
          start={annotation.clip_start_seconds}
          end={annotation.clip_end_seconds}
          poster={
            annotation.screenshot_key
              ? api.mediaUrl(annotation.screenshot_key)
              : null
          }
        />
      );
    }
  }

  if (type === "article" || annotation.clip_text) {
    return (
      <div className="space-y-4">
        {annotation.clip_text && (
          <QuoteCard text={annotation.clip_text} domain={annotation.domain} />
        )}
        {annotation.screenshot_key && (
          <div>
            <p className="metrics-font mb-2 text-[10px] uppercase tracking-widest text-on-surface-variant">
              Screenshot below
            </p>
            <img
              src={api.mediaUrl(annotation.screenshot_key)}
              alt="Page screenshot"
              className="w-full rounded-[var(--radius-card)] border border-outline-variant/20"
              loading="lazy"
            />
          </div>
        )}
      </div>
    );
  }

  if (type === "image") {
    const src = annotation.screenshot_key
      ? api.mediaUrl(annotation.screenshot_key)
      : annotation.source_url;
    return (
      <img
        src={src}
        alt={annotation.source_title || "Annotated image"}
        className="w-full rounded-[var(--radius-card)] border border-outline-variant/20"
        loading="lazy"
      />
    );
  }

  // Fallback: show screenshot or empty
  if (annotation.screenshot_key) {
    return (
      <img
        src={api.mediaUrl(annotation.screenshot_key)}
        alt=""
        className="w-full rounded-[var(--radius-card)] border border-outline-variant/20"
        loading="lazy"
      />
    );
  }

  return null;
}
