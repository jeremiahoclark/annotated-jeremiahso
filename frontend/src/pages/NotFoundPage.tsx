import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="metrics-font text-xs uppercase tracking-widest text-primary-container">
        404
      </p>
      <h1 className="news-title mt-3 text-4xl font-bold text-on-surface">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-sm text-on-surface-variant">
        That route does not exist. The clip may have moved, or the link is
        incomplete.
      </p>
      <Link
        to="/"
        className="mt-8 rounded-xl bg-primary-container px-6 py-3 text-sm font-semibold text-on-primary transition-transform active:scale-[0.98]"
      >
        Back home
      </Link>
    </div>
  );
}
