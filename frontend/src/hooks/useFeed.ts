import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { FeedItem, SortMode } from "@/lib/types";
import { FEED_PAGE_SIZE } from "@/utils/constants";

export function useFeed(sort: SortMode) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (reset: boolean) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      if (reset) {
        setLoading(true);
        setError(null);
        offsetRef.current = 0;
      } else {
        setLoadingMore(true);
      }

      try {
        const res = await api.feed(
          {
            limit: FEED_PAGE_SIZE,
            offset: reset ? 0 : offsetRef.current,
            sort,
          },
          { signal: ac.signal }
        );
        if (ac.signal.aborted) return;
        setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
        offsetRef.current = (reset ? 0 : offsetRef.current) + res.items.length;
        setHasMore(res.items.length >= FEED_PAGE_SIZE);
        setError(null);
      } catch (err) {
        if (ac.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load feed");
      } finally {
        if (!ac.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [sort]
  );

  useEffect(() => {
    load(true);
    return () => abortRef.current?.abort();
  }, [load]);

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    reload: () => load(true),
    loadMore: () => {
      if (!loadingMore && hasMore && !loading) load(false);
    },
  };
}
