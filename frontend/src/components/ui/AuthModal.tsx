import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  nextPath?: string | null;
}

export function AuthModal({ isOpen, onClose, nextPath }: AuthModalProps) {
  const next = nextPath
    ? `?next=${encodeURIComponent(nextPath)}`
    : "";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-sm overflow-hidden rounded-[var(--radius-card)] border border-outline-variant/20 bg-surface-container-high p-6"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-primary-container" />

            <div className="mb-4 flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container/15">
                <span className="text-lg" aria-hidden>
                  ✦
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="-mr-2 -mt-2 rounded-lg p-2 text-on-surface-variant transition-colors hover:text-on-surface"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <h2
              id="auth-modal-title"
              className="news-title mb-2 text-2xl font-bold text-on-surface"
            >
              Join the conversation
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-on-surface-variant">
              Sign in to vote, comment, and clip media with the community.
            </p>

            <div className="flex flex-col gap-3">
              <Link
                to={`/auth${next}`}
                onClick={onClose}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition-transform active:scale-[0.98]"
              >
                Continue with Google
              </Link>
              <Link
                to={`/auth${next}`}
                onClick={onClose}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container px-4 py-3 text-sm font-medium text-on-surface transition-transform active:scale-[0.98]"
              >
                Continue with X
              </Link>
              <Link
                to={`/auth${next}`}
                onClick={onClose}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container px-4 py-3 text-sm font-medium text-on-surface transition-transform active:scale-[0.98]"
              >
                Continue with Email
              </Link>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
