import { Link } from "react-router-dom";
import { FAIR_USE_DOCS_URL } from "@/utils/constants";

export function FairUsePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <p className="metrics-font text-xs uppercase tracking-widest text-primary-container">
        Policy
      </p>
      <h1 className="news-title mt-2 text-3xl font-bold text-on-surface">
        Fair use on Annotated
      </h1>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-on-surface-variant">
        <p>
          Annotated is a commentary and criticism network. We help people clip
          short excerpts of media they encounter on the web, add their own
          analysis, and link clearly back to the original source.
        </p>
        <p>
          Hard limits are enforced server-side: audio and video clips may be at
          most 90 seconds; text clips may be at most 100 words. Commentary is
          required. Full media is never re-hosted in v1.
        </p>
        <p>
          Every annotation page shows a prominent &ldquo;View original&rdquo;
          link and a fair-use assertion line. Users may flag copyright concerns
          for review.
        </p>
        <p>
          This page is a short public summary. For the full policy write-up, see
          the repository documentation.
        </p>
      </div>
      <div className="mt-10 flex flex-wrap gap-4">
        <a
          href={FAIR_USE_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-primary-container px-5 py-2.5 text-sm font-semibold text-on-primary"
        >
          Full fair-use docs
        </a>
        <Link
          to="/"
          className="rounded-xl border border-outline-variant/40 px-5 py-2.5 text-sm text-on-surface"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
