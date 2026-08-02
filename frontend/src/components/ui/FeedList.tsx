import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { FeedItem, SortMode } from "@/lib/types";
import { FeedCard, FeedCardSkeleton } from "./FeedCard";
import { EmptyState } from "./EmptyState";

export interface FeedListProps {
  items: FeedItem[];
  loading: boolean;
  loadingMore?: boolean;
  error?: string | null;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRetry?: () => void;
  sort?: SortMode;
  compact?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function FeedList({
  items,
  loading,
  loadingMore = false,
  error = null,
  hasMore = false,
  onLoadMore,
  onRetry,
  compact = false,
  emptyTitle = "No annotations yet",
  emptyDescription = "Be the first to clip something and start the conversation.",
}: FeedListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (compact ? 180 : 240),
    overscan: 4,
  });

  useEffect(() => {
    const el = parentRef.current;
    if (!el || !onLoadMore) return;

    function onScroll() {
      if (!el || !onLoadMore || !hasMore || loadingMore) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight < 400) {
        onLoadMore();
      }
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    // Also trigger when window is the scroll container
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, [onLoadMore, hasMore, loadingMore]);

  // Window-based infinite scroll (page scrolls, not inner div)
  useEffect(() => {
    if (!onLoadMore) return;
    function onWindowScroll() {
      if (!hasMore || loadingMore || !onLoadMore) return;
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 500;
      if (nearBottom) onLoadMore();
    }
    window.addEventListener("scroll", onWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", onWindowScroll);
  }, [onLoadMore, hasMore, loadingMore]);

  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col gap-4" data-testid="feed-loading">
        {Array.from({ length: 4 }).map((_, i) => (
          <FeedCardSkeleton key={i} compact={compact} />
        ))}
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div
        className="rounded-[var(--radius-card)] border border-error-container/30 bg-surface-container px-6 py-10 text-center"
        data-testid="feed-error"
      >
        <p className="text-sm text-error">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-xl bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        cta="extension"
      />
    );
  }

  // Non-virtualized fallback for short lists / tests (no fixed height parent)
  if (items.length < 8) {
    return (
      <div className="flex flex-col gap-4" data-testid="feed-list">
        {items.map((item) => (
          <FeedCard key={item.id} item={item} compact={compact} />
        ))}
        {loadingMore && <FeedCardSkeleton compact={compact} />}
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="relative w-full"
      style={{ height: virtualizer.getTotalSize() }}
      data-testid="feed-list"
    >
      {virtualItems.map((v) => {
        const item = items[v.index];
        return (
          <div
            key={item.id}
            data-index={v.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full pb-4"
            style={{ transform: `translateY(${v.start}px)` }}
          >
            <FeedCard item={item} compact={compact} />
          </div>
        );
      })}
      {loadingMore && (
        <div className="pt-4">
          <FeedCardSkeleton compact={compact} />
        </div>
      )}
    </div>
  );
}
