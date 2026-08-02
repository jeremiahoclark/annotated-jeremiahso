import { useCallback, useEffect, useState } from "react";
import { APP_ORIGIN } from "../../config";
import { healthOk } from "../../lib/api-client";

export function Feed() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [frameKey, setFrameKey] = useState(0);

  const check = useCallback(async () => {
    if (!navigator.onLine) {
      setOnline(false);
      return;
    }
    const ok = await healthOk(4000);
    setOnline(ok);
  }, []);

  useEffect(() => {
    void check();
    const onOnline = () => void check();
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [check]);

  if (online === null) {
    return <p className="muted">Checking connection…</p>;
  }

  if (!online) {
    return (
      <div className="card offline-card">
        <h2>You&apos;re offline</h2>
        <p className="muted">Reconnect to see the feed.</p>
        <button type="button" className="btn btn-secondary" onClick={() => void check()}>
          Retry
        </button>
      </div>
    );
  }

  const src = `${APP_ORIGIN}/feed?embed=1`;

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="muted">Live feed</span>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setFrameKey((k) => k + 1);
            void check();
          }}
        >
          Refresh
        </button>
      </div>
      <iframe
        key={frameKey}
        className="feed-frame"
        src={src}
        title="Annotated feed"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </>
  );
}
