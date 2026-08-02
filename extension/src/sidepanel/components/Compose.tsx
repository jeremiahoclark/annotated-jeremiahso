import { useEffect, useMemo, useState } from "react";
import {
  APP_ORIGIN,
  MAX_CLIP_SECONDS,
  MAX_CLIP_WORDS,
  MIN_COMMENTARY_CHARS,
} from "../../config";
import {
  ApiClientError,
  createAnnotation,
  healthOk,
} from "../../lib/api-client";
import {
  countNonWhitespace,
  countWords,
  friendlyApiError,
  validateClipWindow,
} from "../../lib/helpers";
import type { ClipDraft, CreateAnnotationRequest, SourceType, StoredAuth } from "../../lib/types";

type Props = {
  draft: ClipDraft | null;
  auth: StoredAuth;
  onPublished: () => void;
  onAuthInvalid: () => void;
};

type Success = { slug: string; url: string; absolute: string };

export function Compose({ draft, auth, onPublished, onAuthInvalid }: Props) {
  const [commentary, setCommentary] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [fairUse, setFairUse] = useState(true);
  const [text, setText] = useState(draft?.text ?? "");
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(90);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    if (!draft) return;
    setText(draft.text ?? "");
    setCommentary("");
    setAnonymous(false);
    setFairUse(true);
    setSuccess(null);
    setError(null);
    if (draft.kind === "av") {
      const s = Math.floor(draft.currentTime ?? 0);
      setStart(s);
      setEnd(s + MAX_CLIP_SECONDS);
    }
  }, [draft]);

  useEffect(() => {
    const tick = async () => {
      if (!navigator.onLine) {
        setOnline(false);
        return;
      }
      setOnline(await healthOk(4000));
    };
    void tick();
    const onOnline = () => void tick();
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Re-mount YT preview when times change (debounced via key on blur / step)
  useEffect(() => {
    if (draft?.kind === "av" && draft.videoId) {
      setPreviewKey((k) => k + 1);
    }
  }, [start, end, draft?.kind, draft?.videoId]);

  const wordCount = countWords(text);
  const commentaryLen = countNonWhitespace(commentary);
  const windowResult =
    draft?.kind === "av" ? validateClipWindow(start, end, MAX_CLIP_SECONDS) : null;

  const disableReason = useMemo(() => {
    if (!draft) return "Right-click media on a page to start a clip.";
    if (!online) return "You’re offline. Reconnect to publish.";
    if (!fairUse) return "Confirm the fair-use checkbox to publish.";
    if (commentaryLen < MIN_COMMENTARY_CHARS) {
      return `Commentary needs ≥ ${MIN_COMMENTARY_CHARS} characters (${commentaryLen} so far).`;
    }
    if (draft.kind === "text" && wordCount > MAX_CLIP_WORDS) {
      return `Text clip is ${wordCount} words (max ${MAX_CLIP_WORDS}).`;
    }
    if (draft.kind === "text" && wordCount === 0) {
      return "Text clip is empty.";
    }
    if (draft.kind === "av" && windowResult && !windowResult.ok) {
      return windowResult.error;
    }
    if (!draft.pageUrl) return "Missing source URL.";
    return null;
  }, [draft, online, fairUse, commentaryLen, wordCount, windowResult]);

  const publish = async () => {
    if (!draft || disableReason) return;
    setBusy(true);
    setError(null);
    try {
      const onlineGate = await healthOk(4000);
      if (!onlineGate) {
        setOnline(false);
        setError("API unreachable. Try again when online.");
        return;
      }

      const source_type = mapSourceType(draft);
      const body: CreateAnnotationRequest = {
        source_url: draft.pageUrl,
        source_type,
        source_title: draft.og?.title || draft.title || null,
        source_author: draft.og?.author || null,
        commentary: commentary.trim(),
        anonymous,
        screenshot_upload_id: draft.screenshot?.upload_id ?? null,
      };

      if (draft.kind === "text") {
        body.clip_text = text.trim();
      }
      if (draft.kind === "av") {
        body.clip_start_seconds = start;
        body.clip_end_seconds = end;
      }

      const res = await createAnnotation(body, auth.token);
      const absolute =
        res.url?.startsWith("http")
          ? res.url
          : `${APP_ORIGIN}${res.url?.startsWith("/") ? "" : "/"}${res.url || `/a/${res.slug}`}`;

      setSuccess({ slug: res.slug, url: res.url, absolute });

      try {
        await chrome.notifications.create(`ann-${res.slug}`, {
          type: "basic",
          iconUrl: chrome.runtime.getURL("icons/128.png"),
          title: "Published on Annotated",
          message: absolute,
        });
      } catch {
        /* notifications optional */
      }

      onPublished();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          onAuthInvalid();
          setError("Session expired. Sign in again.");
        } else {
          setError(friendlyApiError(err.code, err.error));
        }
      } else {
        setError(err instanceof Error ? err.message : "Publish failed");
      }
    } finally {
      setBusy(false);
    }
  };

  if (success) {
    return (
      <div className="card">
        <h2>Published</h2>
        <p className="muted">Your annotation is live.</p>
        <a className="success-url" href={success.absolute} target="_blank" rel="noreferrer">
          {success.absolute}
        </a>
        <div className="row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => chrome.tabs.create({ url: success.absolute })}
          >
            Open
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSuccess(null)}
          >
            Compose another
          </button>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="card">
        <h2>Compose</h2>
        <p className="muted">
          Right-click a video, audio, selection, or page and choose an Annotated clip
          action. Your draft will appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <span className="kind-badge">{draft.kind}</span>
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            {shortUrl(draft.pageUrl)}
          </span>
        </div>
        <h2 style={{ marginTop: 0 }}>{draft.og?.title || draft.title || "Untitled"}</h2>

        {draft.kind === "av" ? (
          <AvEditor
            draft={draft}
            start={start}
            end={end}
            setStart={setStart}
            setEnd={setEnd}
            previewKey={previewKey}
            windowResult={windowResult}
          />
        ) : null}

        {draft.kind === "text" ? (
          <>
            <label className="label" htmlFor="clip-text">
              Clip text
            </label>
            <textarea
              id="clip-text"
              className="field"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className={`counter ${wordCount > MAX_CLIP_WORDS ? "over" : ""}`}>
              {wordCount} / {MAX_CLIP_WORDS} words
            </div>
          </>
        ) : null}

        {(draft.kind === "page" || draft.kind === "image") && draft.screenshot?.dataUrl ? (
          <img className="thumb" src={draft.screenshot.dataUrl} alt="Page capture" />
        ) : null}
        {draft.kind === "image" && draft.imageUrl && !draft.screenshot?.dataUrl ? (
          <img className="thumb" src={draft.imageUrl} alt="Source image" />
        ) : null}
        {draft.kind === "av" && draft.screenshot?.dataUrl ? (
          <img
            className="thumb"
            src={draft.screenshot.dataUrl}
            alt="Frame capture"
            style={{ marginTop: 8 }}
          />
        ) : null}
      </div>

      <div className="card">
        <label className="label" htmlFor="commentary">
          Commentary (required)
        </label>
        <textarea
          id="commentary"
          className="field"
          placeholder="Your take — criticism, context, or analysis…"
          value={commentary}
          onChange={(e) => setCommentary(e.target.value)}
        />
        <div
          className={`counter ${commentaryLen < MIN_COMMENTARY_CHARS ? "warn" : ""}`}
        >
          {commentaryLen} / {MIN_COMMENTARY_CHARS}+ chars
        </div>

        <label className="toggle" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
          />
          <span>
            <strong>Anonymous</strong>
            <span className="muted"> — hide your handle on this post</span>
          </span>
        </label>

        <label className="toggle" style={{ marginTop: 10 }}>
          <input
            type="checkbox"
            checked={fairUse}
            onChange={(e) => setFairUse(e.target.checked)}
          />
          <span>
            My take adds commentary/criticism. This clip credits and links the original.
          </span>
        </label>

        {error ? <p className="error-text">{error}</p> : null}
        {disableReason ? <p className="muted">{disableReason}</p> : null}

        <button
          type="button"
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 8 }}
          disabled={!!disableReason || busy}
          onClick={() => void publish()}
        >
          {busy ? "Publishing…" : "Publish"}
        </button>
      </div>
    </>
  );
}

function AvEditor({
  draft,
  start,
  end,
  setStart,
  setEnd,
  previewKey,
  windowResult,
}: {
  draft: ClipDraft;
  start: number;
  end: number;
  setStart: (n: number) => void;
  setEnd: (n: number) => void;
  previewKey: number;
  windowResult: ReturnType<typeof validateClipWindow> | null;
}) {
  const duration = end - start;
  const yt = draft.videoId;

  return (
    <>
      {yt ? (
        <iframe
          key={previewKey}
          className="preview-frame"
          title="YouTube preview"
          src={`https://www.youtube-nocookie.com/embed/${yt}?start=${Math.floor(start)}&end=${Math.ceil(end)}&rel=0`}
          allow="accelerometer; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : null}

      <div className="row" style={{ marginTop: 8, marginBottom: 4 }}>
        <span className="pill">
          {duration > 0 ? `${duration.toFixed(1)}s` : "—"} / {MAX_CLIP_SECONDS}s
        </span>
        {draft.duration != null ? (
          <span className="muted">source {Math.round(draft.duration)}s</span>
        ) : null}
      </div>

      <div className="time-inputs">
        <div className="time-group">
          <span className="label">Start (s)</span>
          <div className="stepper">
            <button
              type="button"
              className="btn-icon"
              aria-label="Decrease start"
              onClick={() => setStart(round1(Math.max(0, start - 1)))}
            >
              −
            </button>
            <input
              className="field"
              type="number"
              min={0}
              step={0.1}
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
            />
            <button
              type="button"
              className="btn-icon"
              aria-label="Increase start"
              onClick={() => setStart(round1(start + 1))}
            >
              +
            </button>
          </div>
        </div>
        <div className="time-group">
          <span className="label">End (s)</span>
          <div className="stepper">
            <button
              type="button"
              className="btn-icon"
              aria-label="Decrease end"
              onClick={() => setEnd(round1(Math.max(0, end - 1)))}
            >
              −
            </button>
            <input
              className="field"
              type="number"
              min={0}
              step={0.1}
              value={end}
              onChange={(e) => setEnd(Number(e.target.value))}
            />
            <button
              type="button"
              className="btn-icon"
              aria-label="Increase end"
              onClick={() => setEnd(round1(end + 1))}
            >
              +
            </button>
          </div>
        </div>
      </div>
      {windowResult && !windowResult.ok ? (
        <p className="error-text">{windowResult.error}</p>
      ) : null}
    </>
  );
}

function mapSourceType(draft: ClipDraft): SourceType {
  switch (draft.kind) {
    case "av":
      // Prefer video for YouTube / video elements; audio if clearly audio-only URL
      if (
        draft.currentSrc &&
        /\.(mp3|m4a|ogg|wav)(\?|$)/i.test(draft.currentSrc) &&
        !draft.isYouTubePage
      ) {
        return "audio";
      }
      return "video";
    case "text":
    case "page":
      return "article";
    case "image":
      return "image";
    default:
      return "article";
  }
}

function shortUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 32);
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
