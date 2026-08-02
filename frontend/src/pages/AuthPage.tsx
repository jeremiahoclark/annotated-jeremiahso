import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

function callbackURL(next: string | null): string {
  if (typeof window === "undefined") return "/";
  if (next && next.startsWith("/")) return `${window.location.origin}${next}`;
  return window.location.origin + (next || "/");
}

export function AuthPage() {
  const [params] = useSearchParams();
  const next = params.get("next");
  const [email, setEmail] = useState("");
  const [magicState, setMagicState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function socialSignIn(provider: "google" | "twitter") {
    const cb = encodeURIComponent(callbackURL(next));
    window.location.href = `/api/auth/sign-in/social?provider=${provider}&callbackURL=${cb}`;
  }

  async function sendMagicLink(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setMagicState("sending");
    setError(null);
    setDevLink(null);
    try {
      const res = await fetch("/api/auth/sign-in/magic-link", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          callbackURL: callbackURL(next),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        dev_link?: string;
        url?: string;
      };
      if (!res.ok) {
        throw new Error(body.error || "Failed to send magic link");
      }
      const link = body.dev_link || body.url || null;
      if (link) setDevLink(link);
      setMagicState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setMagicState("error");
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <h1 className="news-title text-center text-3xl font-bold text-on-surface">
        Sign in
      </h1>
      <p className="mt-2 text-center text-sm text-on-surface-variant">
        Join Annotated to vote, comment, and clip the open web.
      </p>

      <div className="mt-10 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => socialSignIn("google")}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition-transform active:scale-[0.98]"
        >
          <GoogleIcon />
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => socialSignIn("twitter")}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-outline-variant/40 bg-surface-container px-4 py-3 text-sm font-medium text-on-surface transition-transform active:scale-[0.98]"
        >
          <XIcon />
          Continue with X
        </button>
      </div>

      <div className="my-8 flex items-center gap-3">
        <div className="h-px flex-1 bg-outline-variant/30" />
        <span className="metrics-font text-[10px] uppercase tracking-widest text-on-surface-variant">
          or email
        </span>
        <div className="h-px flex-1 bg-outline-variant/30" />
      </div>

      {magicState === "sent" ? (
        <div className="rounded-[var(--radius-card)] border border-secondary-container/30 bg-surface-container p-5 text-center">
          <p className="font-medium text-on-surface">Check your inbox</p>
          <p className="mt-2 text-sm text-on-surface-variant">
            We sent a magic link to <strong>{email}</strong>. Click it to finish
            signing in.
          </p>
          {devLink && (
            <div className="mt-4 rounded-xl border border-primary-container/40 bg-primary-container/10 p-3 text-left">
              <p className="metrics-font text-[10px] uppercase tracking-widest text-primary">
                Development mode
              </p>
              <a
                href={devLink}
                className="mt-1 block break-all text-xs text-primary-container underline"
              >
                {devLink}
              </a>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
          <label className="text-xs text-on-surface-variant">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-xl border border-outline-variant/30 bg-surface-container px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary-container/50 focus:outline-none"
            />
          </label>
          {error && <p className="text-xs text-error">{error}</p>}
          <button
            type="submit"
            disabled={magicState === "sending"}
            className="rounded-xl bg-primary-container px-4 py-3 text-sm font-semibold text-on-primary disabled:opacity-60"
          >
            {magicState === "sending" ? "Sending…" : "Send magic link"}
          </button>
        </form>
      )}

      <p className="mt-8 text-center text-xs text-on-surface-variant">
        <Link to="/" className="hover:text-primary">
          Back home
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}
