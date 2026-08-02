import { Link } from "react-router-dom";
import { cn } from "@/utils/cn";
import { EXTENSION_URL } from "@/utils/constants";

interface EmptyStateProps {
  title: string;
  description?: string;
  className?: string;
  cta?: "extension" | "feed" | "home" | null;
}

export function EmptyState({
  title,
  description,
  className,
  cta = null,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-outline-variant/40 bg-surface-container/50 px-6 py-14 text-center",
        className
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-container/15 text-primary-container">
        <span className="text-xl" aria-hidden>
          ⌘
        </span>
      </div>
      <h3 className="news-title text-xl font-semibold text-on-surface">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-on-surface-variant">
          {description}
        </p>
      )}
      {cta === "extension" && (
        <a
          href={EXTENSION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 rounded-xl bg-primary-container px-5 py-2.5 text-sm font-semibold text-on-primary transition-transform active:scale-[0.98]"
        >
          Get the Chrome extension
        </a>
      )}
      {cta === "feed" && (
        <Link
          to="/feed"
          className="mt-6 rounded-xl bg-primary-container px-5 py-2.5 text-sm font-semibold text-on-primary transition-transform active:scale-[0.98]"
        >
          Browse the feed
        </Link>
      )}
      {cta === "home" && (
        <Link
          to="/"
          className="mt-6 rounded-xl bg-primary-container px-5 py-2.5 text-sm font-semibold text-on-primary transition-transform active:scale-[0.98]"
        >
          Back home
        </Link>
      )}
    </div>
  );
}
