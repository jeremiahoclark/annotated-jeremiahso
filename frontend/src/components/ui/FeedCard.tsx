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
        "group cursor-pointer rounded-[var(--radius-card)] border border-outline-variant/10 bg-surface-container transition-colors duration-300",
        "hover:border-primary-container/30 hover:bg-surface-container-high active:border-primary-container/50",
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
          <span className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant">
            <span className="metrics-font uppercase tracking-widest">
              {item.domain}
            </span>
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-on-surface-variant hover:text-primary"
              aria-label="Open original source"
              title="Open original"
            >
              <ExternalLinkIcon />
            </a>
          </span>
        )}
        <span className="metrics-font ml-auto text-sm text-on-surface-variant">
          {relativeTime(item.created_at)}
        </span>
      </div>

      <div className="mb-2 flex items-start gap-2">
        <h3
          className={cn(
            "news-title font-semibold leading-snug text-on-surface transition-colors group-hover:text-primary",
            compact ? "text-base" : "text-lg"
          )}
        >
          {item.source_title || item.domain || "Untitled source"}
        </h3>
        {!item.domain && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 shrink-0 text-on-surface-variant hover:text-primary"
            aria-label="Open original source"
            title="Open original"
          >
            <ExternalLinkIcon />
          </a>
        )}
      </div>

      {item.clip_text ? (
        <p
          className={cn(
            "news-title mb-3 line-clamp-fade-2 italic text-on-surface-variant",
            compact ? "text-sm" : "text-base"
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
          "mb-4 line-clamp-fade-2 font-body text-on-surface",
          compact ? "text-sm" : "text-[15px]"
        )}
      >
        {item.commentary}
      </p>

      <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant/10 pt-3">
        {item.anonymous || !item.author.handle ? (
          <span className="text-sm text-on-surface-variant">{authorLabel}</span>
        ) : (
          <Link
            to={`/@${item.author.handle}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-on-surface-variant hover:text-primary"
          >
            {authorLabel}
          </Link>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="metrics-font text-sm text-on-surface-variant">
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

/** Lucide ExternalLink path at 14px */
function ExternalLinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
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
