import { cn } from "@/utils/cn";
import type { SourceType } from "@/lib/types";

const LABELS: Record<string, string> = {
  video: "VIDEO",
  audio: "AUDIO",
  article: "ARTICLE",
  image: "IMAGE",
};

const STYLES: Record<string, string> = {
  video: "text-primary-container border-primary-container/40 bg-primary-container/10",
  audio: "text-tertiary-container border-tertiary-container/40 bg-tertiary-container/10",
  article: "text-secondary-container border-secondary-container/40 bg-secondary-container/10",
  image: "text-on-surface-variant border-outline-variant/40 bg-surface-container-high",
};

interface MediaBadgeProps {
  type: SourceType | string;
  className?: string;
}

export function MediaBadge({ type, className }: MediaBadgeProps) {
  const key = (type || "article").toLowerCase();
  return (
    <span
      className={cn(
        "metrics-font inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest",
        STYLES[key] || STYLES.image,
        className
      )}
    >
      {LABELS[key] || key.toUpperCase()}
    </span>
  );
}
