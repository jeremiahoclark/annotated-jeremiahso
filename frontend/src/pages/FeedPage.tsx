import { useSearchParams } from "react-router-dom";
import type { SortMode } from "@/lib/types";
import { useFeed } from "@/hooks/useFeed";
import { FeedList } from "@/components/ui/FeedList";
import { cn } from "@/utils/cn";

export function FeedPage() {
  const [params, setParams] = useSearchParams();
  const sort: SortMode = params.get("sort") === "new" ? "new" : "hot";
  const { items, loading, loadingMore, error, hasMore, reload, loadMore } =
    useFeed(sort);

  function setSort(next: SortMode) {
    const p = new URLSearchParams(params);
    if (next === "hot") p.delete("sort");
    else p.set("sort", next);
    setParams(p, { replace: true });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="news-title text-3xl font-bold text-on-surface">Feed</h1>
        <div
          className="flex rounded-xl border border-outline-variant/25 bg-surface-container p-1"
          role="tablist"
          aria-label="Sort"
        >
          {(["hot", "new"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={sort === s}
              onClick={() => setSort(s)}
              className={cn(
                "metrics-font rounded-lg px-3.5 py-1.5 text-xs uppercase tracking-wider transition-colors",
                sort === s
                  ? "bg-primary-container text-on-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <FeedList
        items={items}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onRetry={reload}
        sort={sort}
      />
    </div>
  );
}
