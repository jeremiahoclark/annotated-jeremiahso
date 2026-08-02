import { useEffect, useRef } from "react";

interface BoundedMediaProps {
  src: string;
  kind: "video" | "audio";
  start?: number | null;
  end?: number | null;
  poster?: string | null;
}

/**
 * HTML5 media with clip window enforcement:
 * - seeks clamped to [start, end]
 * - pauses at end via timeupdate
 */
export function BoundedMedia({
  src,
  kind,
  start = 0,
  end,
  poster,
}: BoundedMediaProps) {
  const ref = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const startSec = start ?? 0;
  const endSec = end ?? null;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onLoaded = () => {
      if (startSec > 0 && el.currentTime < startSec) {
        el.currentTime = startSec;
      }
    };

    const onTimeUpdate = () => {
      if (endSec != null && el.currentTime >= endSec) {
        el.pause();
        el.currentTime = endSec;
      }
      if (el.currentTime < startSec) {
        el.currentTime = startSec;
      }
    };

    const onSeeking = () => {
      if (el.currentTime < startSec) el.currentTime = startSec;
      if (endSec != null && el.currentTime > endSec) el.currentTime = endSec;
    };

    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("seeking", onSeeking);
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("seeking", onSeeking);
    };
  }, [startSec, endSec, src]);

  if (kind === "audio") {
    return (
      <div className="rounded-[var(--radius-card)] border border-outline-variant/20 bg-surface-container p-4">
        <audio
          ref={ref as React.RefObject<HTMLAudioElement>}
          src={src}
          controls
          preload="metadata"
          className="w-full"
        />
      </div>
    );
  }

  return (
    <div
      className="mx-auto overflow-hidden rounded-[var(--radius-card)] border border-outline-variant/20 bg-black"
      style={{ maxWidth: "min(100%, 746px)" }}
    >
      <video
        ref={ref as React.RefObject<HTMLVideoElement>}
        src={src}
        poster={poster ?? undefined}
        controls
        preload="metadata"
        className="aspect-video max-h-[420px] w-full"
      />
    </div>
  );
}
