import { Link } from "react-router-dom";
import { FAIR_USE_DOCS_URL, GITHUB_REPO_URL } from "@/utils/constants";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-outline-variant/15 bg-surface">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="news-title text-lg font-semibold text-primary">
            Annotated
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Built on Cloudflare
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
          <Link to="/fair-use-static" className="hover:text-primary">
            Fair Use policy
          </Link>
          <a
            href={FAIR_USE_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary"
          >
            Docs
          </a>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
