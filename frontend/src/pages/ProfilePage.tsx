import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiClientError } from "@/lib/api";
import type { FeedItem, Profile } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { FeedList } from "@/components/ui/FeedList";
import { formatMonthYear } from "@/utils/format";
import { FEED_PAGE_SIZE } from "@/utils/constants";

export function ProfilePage() {
  const { handle: raw = "" } = useParams();
  // Support /@:handle and bare handle
  const handle = raw.replace(/^@/, "");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setItems([]);
    setOffset(0);

    Promise.all([
      api.getProfile(handle),
      api.getUserAnnotations(handle, { limit: FEED_PAGE_SIZE, offset: 0 }),
    ])
      .then(([prof, feed]) => {
        if (cancelled) return;
        setProfile(prof.profile);
        setItems(feed.items);
        setOffset(feed.items.length);
        setHasMore(feed.items.length >= FEED_PAGE_SIZE);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 404) {
          setError("not_found");
        } else {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [handle]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const feed = await api.getUserAnnotations(handle, {
        limit: FEED_PAGE_SIZE,
        offset,
      });
      setItems((prev) => [...prev, ...feed.items]);
      setOffset((o) => o + feed.items.length);
      setHasMore(feed.items.length >= FEED_PAGE_SIZE);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  }

  if (error === "not_found") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="metrics-font text-xs uppercase tracking-widest text-error">
          404
        </p>
        <h1 className="news-title mt-3 text-3xl font-bold">User not found</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          No profile for @{handle}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      {loading && !profile ? (
        <div className="mb-10 flex animate-pulse items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-surface-container" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-40 rounded bg-surface-container" />
            <div className="h-4 w-24 rounded bg-surface-container" />
          </div>
        </div>
      ) : profile ? (
        <header className="mb-10">
          <div className="flex items-start gap-4">
            <Avatar
              src={profile.avatar_url}
              name={profile.display_name || profile.handle}
              size="lg"
            />
            <div>
              <h1 className="news-title text-2xl font-bold text-on-surface sm:text-3xl">
                {profile.display_name || profile.handle}
              </h1>
              <p className="metrics-font mt-1 text-sm text-on-surface-variant">
                @{profile.handle}
              </p>
              <p className="mt-3 text-sm text-on-surface-variant">
                <span className="metrics-font text-on-surface">
                  {profile.annotation_count}
                </span>{" "}
                {profile.annotation_count === 1 ? "annotation" : "annotations"}
                {" · joined "}
                {formatMonthYear(profile.created_at)}
              </p>
            </div>
          </div>
        </header>
      ) : null}

      <FeedList
        items={items}
        loading={loading}
        loadingMore={loadingMore}
        error={error && error !== "not_found" ? error : null}
        hasMore={hasMore}
        onLoadMore={loadMore}
        compact
        emptyTitle="No public annotations"
        emptyDescription="This annotator has not published any public clips yet."
      />
    </div>
  );
}
