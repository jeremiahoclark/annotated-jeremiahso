import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";
import { api } from "@/lib/api";
import { useAuth } from "@/auth/auth-context";

interface VoteButtonsProps {
  annotationId: number;
  upCount: number;
  downCount: number;
  userVote?: 1 | -1 | 0 | null;
  onChange?: (next: {
    up_count: number;
    down_count: number;
    user_vote: 1 | -1 | 0;
  }) => void;
  compact?: boolean;
  className?: string;
}

function applyOptimistic(
  up: number,
  down: number,
  current: 1 | -1 | 0,
  next: 1 | -1 | 0
): { up: number; down: number; vote: 1 | -1 | 0 } {
  let nextUp = up;
  let nextDown = down;
  if (current === 1) nextUp -= 1;
  if (current === -1) nextDown -= 1;
  if (next === 1) nextUp += 1;
  if (next === -1) nextDown += 1;
  return { up: nextUp, down: nextDown, vote: next };
}

export function VoteButtons({
  annotationId,
  upCount,
  downCount,
  userVote = null,
  onChange,
  compact = false,
  className,
}: VoteButtonsProps) {
  const { user, requireAuth } = useAuth();
  const [up, setUp] = useState(upCount);
  const [down, setDown] = useState(downCount);
  const [vote, setVote] = useState<1 | -1 | 0>(userVote ?? 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUp(upCount);
    setDown(downCount);
    setVote(userVote ?? 0);
  }, [upCount, downCount, userVote, annotationId]);

  async function cast(direction: 1 | -1) {
    if (!user) {
      requireAuth();
      return;
    }
    const next: 1 | -1 | 0 = vote === direction ? 0 : direction;
    const prev = { up, down, vote };
    const optimistic = applyOptimistic(up, down, vote, next);
    setUp(optimistic.up);
    setDown(optimistic.down);
    setVote(optimistic.vote);

    setBusy(true);
    try {
      const res = await api.vote(annotationId, next);
      setUp(res.up_count);
      setDown(res.down_count);
      setVote(res.user_vote);
      onChange?.(res);
    } catch {
      setUp(prev.up);
      setDown(prev.down);
      setVote(prev.vote);
    } finally {
      setBusy(false);
    }
  }

  const hit = compact ? "min-h-9 min-w-9 px-2" : "min-h-9 min-w-9 px-2.5";

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={busy}
        aria-label="Upvote"
        aria-pressed={vote === 1}
        onClick={() => cast(1)}
        className={cn(
          "metrics-font inline-flex items-center justify-center gap-1 rounded-lg border text-sm transition-colors active:scale-95",
          hit,
          vote === 1
            ? "border-primary-container bg-primary-container text-on-primary"
            : "border-outline-variant/40 bg-surface-container text-on-surface-variant hover:border-primary-container/50 hover:text-primary"
        )}
      >
        <span aria-hidden>▲</span>
        <span>{up}</span>
      </button>
      <button
        type="button"
        disabled={busy}
        aria-label="Downvote"
        aria-pressed={vote === -1}
        onClick={() => cast(-1)}
        className={cn(
          "metrics-font inline-flex items-center justify-center gap-1 rounded-lg border text-sm transition-colors active:scale-95",
          hit,
          vote === -1
            ? "border-error-container/60 bg-error-container/25 text-error"
            : "border-outline-variant/40 bg-surface-container text-on-surface-variant hover:border-primary-container/50 hover:text-primary"
        )}
      >
        <span aria-hidden>▼</span>
        <span>{down}</span>
      </button>
    </div>
  );
}
