import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import type { FeedItem } from "@/lib/types";
import { cn } from "@/utils/cn";
import { formatClipWindow, relativeTime } from "@/utils/format";
import { MediaBadge } from "./MediaBadge";
import { VoteButtons } from "./VoteButtons";

interface FeedCardProps {
  item: FeedItem;
  compact?: boolean;
  className?: string;
}

export function FeedCard({ item, compact = false, className }: FeedCardProps) {
  const navigate = useNavigate();
  const windowChip = formatClipWindow(
    item.clip_start_seconds,
    item.clip_end_seconds
  );
  const authorLabel =
    item.anonymous || !item.author.handle
      ? "Anonymous"
      : `@${item.author.handle}`;

  return (
    <motion.article
      layout={!compact}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group cursor-pointer rounded-[var(--radius-card)] border border-outline-variant/10 bg-surface-container transition-[border-color] duration-300",
        "hover:border-primary-container/30 active:border-primary-container/50",
        compact ? "p-4" : "p-5 sm:p-6",
        className
      )}
      onClick={() => navigate(`/a/${item.slug}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/a/${item.slug}`);
        }
      }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MediaBadge type={item.source_type} />
        {item.domain && (
          <span className="metrics-font text-[10px] uppercase tracking-widest text-on-surface-variant">
            {item.domain}
          </span>
        )}
        <span className="metrics-font ml-auto text-[10px] text-primary/60">
          {relativeTime(item.created_at)}
        </span>
      </div>

      <div className="mb-2 flex items-start gap-2">
        <h3
          className={cn(
            "news-title font-semibold leading-snug text-on-surface group-hover:text-primary transition-colors",
            compact ? "text-base" : "text-lg"
          )}
        >
          {item.source_title || item.domain || "Untitled source"}
        </h3>
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 shrink-0 text-on-surface-variant hover:text-primary"
          aria-label="Open original source"
          title="Open original"
        >
          <OutboundIcon />
        </a>
      </div>

      {item.clip_text ? (
        <p
          className={cn(
            "news-title mb-3 italic text-on-surface-variant",
            compact ? "line-clamp-2 text-sm" : "line-clamp-3 text-base"
          )}
        >
          “{item.clip_text}”
        </p>
      ) : windowChip ? (
        <p className="metrics-font mb-3 inline-flex rounded-lg border border-outline-variant/30 bg-surface-container-high px-2.5 py-1 text-xs text-primary">
          {windowChip}
        </p>
      ) : null}

      <p
        className={cn(
          "mb-4 font-body text-on-surface/90",
          compact ? "line-clamp-2 text-sm" : "line-clamp-2 text-[15px]"
        )}
      >
        {item.commentary}
      </p>

      <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant/10 pt-3">
        {item.anonymous || !item.author.handle ? (
          <span className="text-xs text-on-surface-variant">{authorLabel}</span>
        ) : (
          <Link
            to={`/@${item.author.handle}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-on-surface-variant hover:text-primary"
          >
            {authorLabel}
          </Link>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="metrics-font text-[11px] text-on-surface-variant">
            {item.comment_count}{" "}
            {item.comment_count === 1 ? "comment" : "comments"}
          </span>
          <VoteButtons
            annotationId={item.id}
            upCount={item.up_count}
            downCount={item.down_count}
            compact
          />
        </div>
      </div>
    </motion.article>
  );
}

function OutboundIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 5h5v5M19 5l-7 7M10 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FeedCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--radius-card)] border border-outline-variant/10 bg-surface-container",
        compact ? "p-4" : "p-5 sm:p-6"
      )}
      aria-hidden
    >
      <div className="mb-3 flex gap-2">
        <div className="h-5 w-16 rounded bg-surface-container-high" />
        <div className="h-5 w-24 rounded bg-surface-container-high" />
      </div>
      <div className="mb-3 h-6 w-3/4 rounded bg-surface-container-high" />
      <div className="mb-2 h-4 w-full rounded bg-surface-container-high" />
      <div className="mb-4 h-4 w-2/3 rounded bg-surface-container-high" />
      <div className="h-8 w-full rounded bg-surface-container-high" />
    </div>
  );
}
