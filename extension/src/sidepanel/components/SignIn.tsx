import { useState, type FormEvent } from "react";
import { APP_ORIGIN } from "../../config";
import { launchProviderAuth } from "../../lib/auth";
import { requestMagicLink } from "../../lib/api-client";
import type { StoredAuth } from "../../lib/types";

type Props = {
  onSignedIn: (auth: StoredAuth) => void;
};

export function SignIn({ onSignedIn }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const oauth = async (provider: "google" | "twitter") => {
    setError(null);
    setBusy(provider);
    try {
      const auth = await launchProviderAuth(provider);
      onSignedIn(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(null);
    }
  };

  const sendMagic = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy("email");
    try {
      await requestMagicLink(email.trim(), `${APP_ORIGIN}/auth/extension/complete`);
      setEmailSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send magic link");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card auth-stack">
      <h2>Sign in to annotate</h2>
      <p className="muted">
        Clip media under fair use, add your take, and share. Sign in with Google, X, or
        email.
      </p>

      <button
        type="button"
        className="btn btn-primary"
        disabled={!!busy}
        onClick={() => void oauth("google")}
      >
        {busy === "google" ? "Opening…" : "Continue with Google"}
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={!!busy}
        onClick={() => void oauth("twitter")}
      >
        {busy === "twitter" ? "Opening…" : "Continue with X"}
      </button>

      <div style={{ height: 1, background: "var(--color-outline-variant)", margin: "4px 0" }} />

      {emailSent ? (
        <p className="muted">
          Check your inbox for a magic link. After you open it, return here and sign in
          again if needed — or complete the flow in the popup.
        </p>
      ) : (
        <form className="auth-stack" onSubmit={(e) => void sendMagic(e)}>
          <label className="label" htmlFor="email">
            Email magic link
          </label>
          <input
            id="email"
            className="field"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!!busy}
          />
          <button type="submit" className="btn btn-secondary" disabled={!!busy || !email.trim()}>
            {busy === "email" ? "Sending…" : "Email me a link"}
          </button>
        </form>
      )}

      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
