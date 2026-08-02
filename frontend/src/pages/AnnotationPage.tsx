import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { api, ApiClientError } from "@/lib/api";
import type {
  AnnotationDetailResponse,
  CommentNode,
  ReportReason,
} from "@/lib/types";
import { useAuth } from "@/auth/auth-context";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";
import { MediaBadge } from "@/components/ui/MediaBadge";
import { VoteButtons } from "@/components/ui/VoteButtons";
import { FeedCard } from "@/components/ui/FeedCard";
import { MediaRegion } from "@/components/media/MediaRegion";
import {
  clipDurationSeconds,
  formatClipWindow,
  relativeTime,
} from "@/utils/format";
import { cn } from "@/utils/cn";

export function AnnotationPage() {
  const { slug = "" } = useParams();
  const { user, requireAuth } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<AnnotationDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getAnnotation(slug)
      .then((res) => {
        if (!cancelled) setData(res);
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
  }, [slug]);

  async function submitComment(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      requireAuth();
      return;
    }
    if (!data || !commentBody.trim()) return;
    setCommentBusy(true);
    try {
      await api.postComment(data.annotation.id, { body: commentBody.trim() });
      const refreshed = await api.getAnnotation(slug);
      setData(refreshed);
      setCommentBody("");
      toast("Comment posted", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to comment", "error");
    } finally {
      setCommentBusy(false);
    }
  }

  async function copyLink() {
    const url = window.location.href.split("?")[0];
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied", "success");
    } catch {
      toast("Could not copy link", "error");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6" data-testid="annotation-loading">
        <div className="aspect-video animate-pulse rounded-[var(--radius-card)] bg-surface-container" />
        <div className="mt-6 h-8 w-2/3 animate-pulse rounded bg-surface-container" />
        <div className="mt-4 h-24 animate-pulse rounded bg-surface-container" />
      </div>
    );
  }

  if (error === "not_found" || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="metrics-font text-xs uppercase tracking-widest text-error">
          404
        </p>
        <h1 className="news-title mt-3 text-3xl font-bold">Annotation not found</h1>
        <Link
          to="/feed"
          className="mt-8 inline-block rounded-xl bg-primary-container px-5 py-2.5 text-sm font-semibold text-on-primary"
        >
          Back to feed
        </Link>
      </div>
    );
  }

  const a = data.annotation;
  const windowChip = formatClipWindow(a.clip_start_seconds, a.clip_end_seconds);
  const duration = clipDurationSeconds(a.clip_start_seconds, a.clip_end_seconds);
  const fairUseLead =
    duration != null
      ? `Approx. ${duration}s clip`
      : a.clip_text
        ? "100-word-or-less quote"
        : "Fair-use excerpt";

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10"
      data-testid="annotation-page"
    >
      {a.parent && (
        <Link
          to={`/a/${a.parent.slug}`}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-xs text-on-surface-variant hover:border-primary-container/40 hover:text-primary"
        >
          <span className="metrics-font uppercase tracking-wider">In reply to</span>
          <span className="truncate max-w-[200px]">{a.parent.title_snippet}</span>
        </Link>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MediaBadge type={a.source_type} />
        {a.domain && (
          <span className="metrics-font text-[10px] uppercase tracking-widest text-on-surface-variant">
            {a.domain}
          </span>
        )}
        {windowChip && (
          <span
            className="metrics-font rounded-lg border border-outline-variant/30 bg-surface-container-high px-2.5 py-1 text-xs text-primary"
            data-testid="clip-window-chip"
          >
            {windowChip}
          </span>
        )}
      </div>

      <h1 className="news-title mb-6 text-2xl font-bold text-on-surface sm:text-3xl">
        {a.source_title || a.domain || "Annotation"}
      </h1>

      <MediaRegion annotation={a} />

      {/* Extra screenshot if not already shown in article flow */}
      {a.screenshot_key &&
        a.source_type !== "article" &&
        a.source_type !== "image" && (
          <div className="mt-4">
            <p className="metrics-font mb-2 text-[10px] uppercase tracking-widest text-on-surface-variant">
              Screenshot
            </p>
            <img
              src={api.mediaUrl(a.screenshot_key)}
              alt="Clip screenshot"
              className="w-full rounded-[var(--radius-card)] border border-outline-variant/20"
              loading="lazy"
            />
          </div>
        )}

      {a.transcript_excerpt && (
        <div className="mt-4 rounded-[var(--radius-card)] border border-outline-variant/20 bg-surface-container p-4">
          <p className="metrics-font mb-2 text-[10px] uppercase tracking-widest text-on-surface-variant">
            Transcript window
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            {a.transcript_excerpt}
          </p>
        </div>
      )}

      {/* Fair-use line */}
      <p
        className="mt-5 text-sm text-on-surface-variant"
        data-testid="fair-use-line"
      >
        {fairUseLead}
        {" · shared under fair-use commentary/criticism · original: "}
        <a
          href={a.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-primary-container hover:text-primary"
        >
          View original
          {a.domain ? ` (${a.domain})` : ""}
        </a>
      </p>

      {/* Commentary */}
      <section className="mt-8 border-t border-outline-variant/15 pt-8">
        <p
          className="font-body text-lg leading-relaxed text-on-surface"
          data-testid="commentary"
        >
          {a.commentary}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {a.anonymous || !a.author.handle ? (
            <div className="flex items-center gap-2">
              <Avatar name="Anonymous" size="sm" />
              <span className="text-sm text-on-surface-variant">Anonymous</span>
            </div>
          ) : (
            <Link
              to={`/@${a.author.handle}`}
              className="flex items-center gap-2 hover:text-primary"
            >
              <Avatar
                src={a.author.avatar_url}
                name={a.author.display_name}
                size="sm"
              />
              <span className="text-sm">@{a.author.handle}</span>
            </Link>
          )}
          <span className="metrics-font text-xs text-on-surface-variant">
            {relativeTime(a.created_at)}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <VoteButtons
            annotationId={a.id}
            upCount={a.up_count}
            downCount={a.down_count}
            userVote={data.user_vote}
          />
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="rounded-lg border border-outline-variant/30 px-3 py-1.5 text-xs text-on-surface-variant transition-colors hover:border-error/40 hover:text-error"
          >
            Flag: copyright concern
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="ml-auto rounded-lg border border-outline-variant/30 px-3 py-1.5 text-xs text-on-surface-variant transition-colors hover:border-primary-container/40 hover:text-primary"
          >
            Copy link
          </button>
        </div>
      </section>

      {/* Follow-up clips */}
      {a.children && a.children.length > 0 && (
        <section className="mt-10">
          <h2 className="news-title mb-4 text-xl font-semibold">
            Follow-up clips
          </h2>
          <div className="flex flex-col gap-3">
            {a.children.map((child) => (
              <FeedCard key={child.id} item={child} compact />
            ))}
          </div>
        </section>
      )}

      {/* Comments */}
      <section className="mt-12 border-t border-outline-variant/15 pt-8">
        <h2 className="news-title mb-4 text-xl font-semibold">
          Comments{" "}
          <span className="metrics-font text-sm font-normal text-on-surface-variant">
            ({a.comment_count})
          </span>
        </h2>

        <form onSubmit={submitComment} className="mb-6">
          <textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            onFocus={() => {
              if (!user) requireAuth();
            }}
            placeholder={user ? "Add a comment…" : "Sign in to comment"}
            rows={3}
            maxLength={1000}
            className="w-full resize-y rounded-2xl border border-outline-variant/25 bg-surface-container px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary-container/50 focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={commentBusy || !commentBody.trim()}
              className="rounded-xl bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
            >
              {commentBusy ? "Posting…" : "Post"}
            </button>
          </div>
        </form>

        {data.comments.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            No comments yet. Start the thread.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {data.comments.map((c) => (
              <CommentItem key={c.id} node={c} />
            ))}
          </ul>
        )}
      </section>

      {reportOpen && (
        <ReportDialog
          annotationId={a.id}
          onClose={() => setReportOpen(false)}
          onDone={() => {
            setReportOpen(false);
            toast("Report submitted", "success");
          }}
        />
      )}
    </motion.article>
  );
}

function CommentItem({ node }: { node: CommentNode }) {
  return (
    <li className="rounded-2xl border border-outline-variant/15 bg-surface-container p-4">
      <div className="mb-2 flex items-center gap-2">
        <Avatar
          src={node.author.avatar_url}
          name={node.author.display_name}
          size="sm"
        />
        {node.author.handle ? (
          <Link
            to={`/@${node.author.handle}`}
            className="text-sm font-medium hover:text-primary"
          >
            @{node.author.handle}
          </Link>
        ) : (
          <span className="text-sm text-on-surface-variant">
            {node.author.display_name || "User"}
          </span>
        )}
        <span className="metrics-font text-[10px] text-on-surface-variant">
          {relativeTime(node.created_at)}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-on-surface">
        {node.deleted_at ? (
          <em className="text-on-surface-variant">[deleted]</em>
        ) : (
          node.body
        )}
      </p>
      {node.children?.length > 0 && (
        <ul className="mt-3 space-y-3 border-l border-outline-variant/20 pl-4">
          {node.children.map((child) => (
            <CommentItem key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

function ReportDialog({
  annotationId,
  onClose,
  onDone,
}: {
  annotationId: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState<ReportReason>("copyright_concern");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.report(annotationId, {
        reason,
        body: body.trim() || null,
      });
      onDone();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <form
        onSubmit={submit}
        className={cn(
          "relative w-full max-w-sm rounded-[var(--radius-card)] border border-outline-variant/25 bg-surface-container-high p-6"
        )}
        role="dialog"
        aria-labelledby="report-title"
      >
        <h2 id="report-title" className="news-title text-xl font-semibold">
          Flag annotation
        </h2>
        <label className="mt-4 block text-xs text-on-surface-variant">
          Reason
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as ReportReason)}
            className="mt-1 w-full rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface"
          >
            <option value="copyright_concern">Copyright concern</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="mt-3 block text-xs text-on-surface-variant">
          Details (optional)
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface"
          />
        </label>
        {err && <p className="mt-2 text-xs text-error">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-on-surface-variant"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-error-container px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
          >
            {busy ? "Sending…" : "Submit flag"}
          </button>
        </div>
      </form>
    </div>
  );
}
