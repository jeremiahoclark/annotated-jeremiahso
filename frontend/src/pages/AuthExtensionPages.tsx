import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

/** Extension OAuth start: provider buttons with callback to /auth/extension/complete */
export function AuthExtensionStartPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const completeURL =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/extension/complete`
      : "/auth/extension/complete";

  function social(provider: "google" | "twitter") {
    const cb = encodeURIComponent(completeURL);
    window.location.href = `/api/auth/sign-in/social?provider=${provider}&callbackURL=${cb}`;
  }

  async function magic(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/auth/sign-in/magic-link", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          callbackURL: completeURL,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        dev_link?: string;
        url?: string;
      };
      if (!res.ok) throw new Error(body.error || "Failed");
      if (body.dev_link || body.url) setDevLink(body.dev_link || body.url || null);
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="news-title text-2xl font-bold text-primary">
        Annotated extension
      </h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        Sign in to clip and publish from Chrome.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => social("google")}
          className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-black"
        >
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => social("twitter")}
          className="rounded-xl border border-outline-variant/40 bg-surface-container px-4 py-3 text-sm font-medium"
        >
          Continue with X
        </button>
      </div>
      {status === "sent" ? (
        <p className="mt-6 text-sm text-secondary">Check your inbox.</p>
      ) : (
        <form onSubmit={magic} className="mt-6 flex flex-col gap-2 text-left">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email magic link"
            className="w-full rounded-xl border border-outline-variant/30 bg-surface-container px-4 py-3 text-sm"
          />
          {error && <p className="text-xs text-error">{error}</p>}
          <button
            type="submit"
            disabled={status === "sending"}
            className="rounded-xl bg-primary-container px-4 py-3 text-sm font-semibold text-on-primary"
          >
            Send magic link
          </button>
        </form>
      )}
      {devLink && (
        <a href={devLink} className="mt-4 block break-all text-xs text-primary">
          {devLink}
        </a>
      )}
    </div>
  );
}

/** Extension OAuth complete: mint token, show close message, postMessage. */
export function AuthExtensionCompletePage() {
  const [params] = useSearchParams();
  const tokenParam = params.get("token");
  const [status, setStatus] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        let token = tokenParam;

        // If OAuth redirected with session cookie but no token, mint one
        if (!token) {
          const res = await fetch("/api/auth/extension/token", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          if (!res.ok) {
            throw new Error("Could not mint extension token");
          }
          const body = (await res.json()) as { token: string };
          token = body.token;
        }

        if (cancelled) return;

        // Notify opener (launchWebAuthFlow) and self
        const payload = { type: "annotated_extension_auth", token };
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, "*");
          }
        } catch {
          /* ignore */
        }
        window.postMessage(payload, "*");

        // Put token in URL for chrome.identity.launchWebAuthFlow redirect capture
        if (!tokenParam && token) {
          const url = new URL(window.location.href);
          url.searchParams.set("token", token);
          window.history.replaceState({}, "", url.toString());
        }

        setStatus("done");
        setMessage("Signed in. You can close this tab.");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Sign-in failed. Close this tab and try again.");
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [tokenParam]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div
        className={
          status === "error"
            ? "text-error"
            : status === "done"
              ? "text-secondary"
              : "text-primary"
        }
      >
        <span className="text-3xl" aria-hidden>
          {status === "done" ? "✓" : status === "error" ? "!" : "…"}
        </span>
      </div>
      <h1 className="news-title mt-4 text-2xl font-bold text-on-surface">
        {status === "done" ? "Signed in" : status === "error" ? "Error" : "Almost there"}
      </h1>
      <p className="mt-2 text-sm text-on-surface-variant">{message}</p>
    </div>
  );
}
