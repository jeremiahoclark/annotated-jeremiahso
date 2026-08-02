import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, ApiClientError } from "@/lib/api";
import type { Me } from "@/lib/types";
import { AuthModal } from "@/components/ui/AuthModal";

interface AuthContextValue {
  user: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  /** Open auth modal, optionally remembering return path. */
  requireAuth: (nextPath?: string) => void;
  closeAuthModal: () => void;
  authModalOpen: boolean;
  authNextPath: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authNextPath, setAuthNextPath] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setUser(null);
      } else {
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  const requireAuth = useCallback((nextPath?: string) => {
    const path =
      nextPath ??
      (typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/");
    setAuthNextPath(path);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      refresh,
      logout,
      requireAuth,
      closeAuthModal,
      authModalOpen,
      authNextPath,
    }),
    [
      user,
      loading,
      refresh,
      logout,
      requireAuth,
      closeAuthModal,
      authModalOpen,
      authNextPath,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal
        isOpen={authModalOpen}
        onClose={closeAuthModal}
        nextPath={authNextPath}
      />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
