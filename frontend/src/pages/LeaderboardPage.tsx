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

const ROW_CAP = 10;

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="news-title text-3xl font-bold text-on-surface">
          Leaderboard
        </h1>
        <div
          className="inline-flex rounded-full bg-surface-container p-1"
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
                "metrics-font rounded-full px-3.5 py-1.5 text-xs uppercase tracking-wider transition-colors",
                window === w.id
                  ? "bg-primary-container font-medium text-black"
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

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Most annotated media */}
        <section className="rounded-[var(--radius-card)] border border-outline-variant/15 bg-surface-container p-4 sm:p-5">
          <h2 className="news-title mb-3 text-lg font-semibold sm:text-xl">
            Most annotated media
          </h2>
          {loading && !data ? (
            <SkeletonRows />
          ) : !data?.most_annotated?.length ? (
            <EmptyNote kind="sources" count={0} />
          ) : (
            <ol className="flex flex-col gap-2">
              {data.most_annotated.map((row, i) => (
                <li
                  key={row.canonical_source_key}
                  className="flex items-start gap-3 border-b border-outline-variant/10 py-2 last:border-0"
                >
                  <span className="metrics-font w-6 shrink-0 text-sm text-primary-container">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-on-surface">
                      {row.title || row.domain || row.canonical_source_key}
                    </p>
                    <p className="metrics-font mt-0.5 text-sm text-on-surface-variant">
                      {row.domain || "unknown"}
                    </p>
                  </div>
                  <span className="metrics-font shrink-0 text-sm text-on-surface-variant">
                    {row.count} {row.count === 1 ? "clip" : "clips"}
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
              {data.most_annotated.length < ROW_CAP && (
                <EmptyNote
                  kind="sources"
                  count={data.most_annotated.length}
                  asRow
                />
              )}
            </ol>
          )}
        </section>

        {/* Top annotators */}
        <section className="rounded-[var(--radius-card)] border border-outline-variant/15 bg-surface-container p-4 sm:p-5">
          <h2 className="news-title mb-3 text-lg font-semibold sm:text-xl">
            Top annotators
          </h2>
          {loading && !data ? (
            <SkeletonRows />
          ) : !data?.top_annotators?.length ? (
            <EmptyNote kind="annotators" count={0} />
          ) : (
            <ol className="flex flex-col gap-2">
              {data.top_annotators.map((row, i) => (
                <li
                  key={row.handle}
                  className="flex items-center gap-3 border-b border-outline-variant/10 py-2 last:border-0"
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
                  <div className="metrics-font shrink-0 text-right text-sm text-on-surface-variant">
                    <div>
                      {row.annotations}{" "}
                      {row.annotations === 1 ? "clip" : "clips"}
                    </div>
                    <div className="text-primary/80">
                      {row.net_votes} net votes
                    </div>
                  </div>
                </li>
              ))}
              {data.top_annotators.length < ROW_CAP && (
                <EmptyNote
                  kind="annotators"
                  count={data.top_annotators.length}
                  asRow
                />
              )}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyNote({
  kind,
  count,
  asRow = false,
}: {
  kind: "sources" | "annotators";
  count: number;
  asRow?: boolean;
}) {
  const message =
    kind === "sources"
      ? `Only ${count} source${count === 1 ? "" : "s"} so far. Be the first to clip something.`
      : `Only ${count} annotator${count === 1 ? "" : "s"} so far. Be the first to clip something.`;

  if (asRow) {
    return (
      <li className="rounded-xl border border-dashed border-outline-variant/30 bg-surface/40 px-3 py-2.5 text-center text-sm text-on-surface-variant">
        {message}
      </li>
    );
  }

  return (
    <p className="rounded-xl border border-dashed border-outline-variant/30 bg-surface/40 px-3 py-4 text-center text-sm text-on-surface-variant">
      {message}
    </p>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-9 rounded-lg bg-surface-container-high" />
      ))}
    </div>
  );
}
