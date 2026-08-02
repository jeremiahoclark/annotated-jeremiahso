import { useCallback, useEffect, useState } from "react";
import { getStoredAuth, signOut } from "../lib/auth";
import type { ClipDraft, StoredAuth } from "../lib/types";
import { Compose } from "./components/Compose";
import { Feed } from "./components/Feed";
import { SignIn } from "./components/SignIn";

type Tab = "compose" | "feed";

export function App() {
  const [auth, setAuth] = useState<StoredAuth | null | undefined>(undefined);
  const [draft, setDraft] = useState<ClipDraft | null>(null);
  const [tab, setTab] = useState<Tab>("feed");

  const loadDraft = useCallback(async () => {
    try {
      const r = await chrome.storage.session.get("clipDraft");
      const d = (r.clipDraft as ClipDraft | undefined) ?? null;
      setDraft(d);
      if (d) setTab("compose");
    } catch {
      /* storage.session unavailable in some contexts */
    }
  }, []);

  const hydrateAuth = useCallback(async () => {
    try {
      const s = await getStoredAuth();
      setAuth(s);
    } catch {
      setAuth(null);
    }
  }, []);

  useEffect(() => {
    void hydrateAuth();
    void loadDraft();

    const onMsg = (msg: { type?: string }) => {
      if (msg?.type === "clip-draft-ready") {
        void loadDraft();
      }
    };
    chrome.runtime.onMessage.addListener(onMsg);

    const onStorage = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area === "session" && changes.clipDraft) {
        const d = (changes.clipDraft.newValue as ClipDraft | undefined) ?? null;
        setDraft(d);
        if (d) setTab("compose");
      }
      if (area === "local" && (changes.token || changes.user)) {
        void hydrateAuth();
      }
    };
    chrome.storage.onChanged.addListener(onStorage);

    return () => {
      chrome.runtime.onMessage.removeListener(onMsg);
      chrome.storage.onChanged.removeListener(onStorage);
    };
  }, [hydrateAuth, loadDraft]);

  const handleSignedIn = (s: StoredAuth) => {
    setAuth(s);
  };

  const handleSignOut = async () => {
    await signOut();
    setAuth(null);
  };

  const handlePublished = async () => {
    await chrome.storage.session.remove("clipDraft");
    setDraft(null);
  };

  if (auth === undefined) {
    return (
      <div className="app">
        <header className="header">
          <div className="brand">
            Annotat<span>ed</span>
          </div>
        </header>
        <div className="panel muted">Loading…</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          Annotat<span>ed</span>
        </div>
        {auth ? (
          <div className="row">
            <span className="user-chip" title={auth.user.handle}>
              @{auth.user.handle}
            </span>
            <button type="button" className="btn btn-ghost" onClick={() => void handleSignOut()}>
              Sign out
            </button>
          </div>
        ) : null}
      </header>

      {!auth ? (
        <div className="panel">
          <SignIn onSignedIn={handleSignedIn} />
        </div>
      ) : (
        <>
          <nav className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={tab === "compose"}
              onClick={() => setTab("compose")}
            >
              Compose{draft ? " ·" : ""}
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={tab === "feed"}
              onClick={() => setTab("feed")}
            >
              Feed
            </button>
          </nav>
          <div className="panel">
            {tab === "compose" ? (
              <Compose
                draft={draft}
                auth={auth}
                onPublished={handlePublished}
                onAuthInvalid={() => void handleSignOut()}
              />
            ) : (
              <Feed />
            )}
          </div>
        </>
      )}
    </div>
  );
}
