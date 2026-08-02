import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { Leaderboard, LeaderboardWindow } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/utils/cn";

const WINDOWS: { id: LeaderboardWindow; label: string }[] = [
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "all", label: "All" },
];

export function LeaderboardPage() {
  const [window, setWindow] = useState<LeaderboardWindow>("7d");
  const [data, setData] = useState<Leaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .leaderboard(window)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [window]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="news-title text-3xl font-bold text-on-surface">
          Leaderboard
        </h1>
        <div
          className="flex rounded-xl border border-outline-variant/25 bg-surface-container p-1"
          role="tablist"
          aria-label="Time window"
        >
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              type="button"
              role="tab"
              aria-selected={window === w.id}
              onClick={() => setWindow(w.id)}
              className={cn(
                "metrics-font rounded-lg px-3.5 py-1.5 text-xs uppercase tracking-wider transition-colors",
                window === w.id
                  ? "bg-primary-container text-on-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-6 text-sm text-error">{error}</p>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Most annotated media */}
        <section className="rounded-[var(--radius-card)] border border-outline-variant/15 bg-surface-container p-5 sm:p-6">
          <h2 className="news-title mb-5 text-xl font-semibold">
            Most annotated media
          </h2>
          {loading && !data ? (
            <SkeletonRows />
          ) : !data?.most_annotated?.length ? (
            <p className="text-sm text-on-surface-variant">No data yet.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {data.most_annotated.map((row, i) => (
                <li
                  key={row.canonical_source_key}
                  className="flex items-start gap-3 border-b border-outline-variant/10 pb-3 last:border-0 last:pb-0"
                >
                  <span className="metrics-font w-6 shrink-0 text-sm text-primary-container">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-on-surface">
                      {row.title || row.domain || row.canonical_source_key}
                    </p>
                    <p className="metrics-font mt-0.5 text-[10px] uppercase tracking-widest text-on-surface-variant">
                      {row.domain || "unknown"}
                    </p>
                  </div>
                  <span className="metrics-font shrink-0 text-xs text-on-surface-variant">
                    {row.count}
                  </span>
                  {row.domain && (
                    <a
                      href={`https://${row.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-on-surface-variant hover:text-primary"
                      aria-label={`Open ${row.domain}`}
                    >
                      ↗
                    </a>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Top annotators */}
        <section className="rounded-[var(--radius-card)] border border-outline-variant/15 bg-surface-container p-5 sm:p-6">
          <h2 className="news-title mb-5 text-xl font-semibold">
            Top annotators
          </h2>
          {loading && !data ? (
            <SkeletonRows />
          ) : !data?.top_annotators?.length ? (
            <p className="text-sm text-on-surface-variant">No data yet.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {data.top_annotators.map((row, i) => (
                <li
                  key={row.handle}
                  className="flex items-center gap-3 border-b border-outline-variant/10 pb-3 last:border-0 last:pb-0"
                >
                  <span className="metrics-font w-6 shrink-0 text-sm text-primary-container">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Avatar name={row.display_name || row.handle} size="sm" />
                  <Link
                    to={`/@${row.handle}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary"
                  >
                    @{row.handle}
                  </Link>
                  <div className="metrics-font shrink-0 text-right text-[11px] text-on-surface-variant">
                    <div>{row.annotations} clips</div>
                    <div className="text-primary/70">{row.net_votes} net</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-surface-container-high" />
      ))}
    </div>
  );
}
