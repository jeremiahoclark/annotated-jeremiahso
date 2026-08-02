import { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/utils/cn";

export function Header() {
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <header className="glass-header sticky top-0 z-50">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="news-title text-xl font-bold tracking-tight text-primary shrink-0"
        >
          Annotated
        </Link>

        <nav className="ml-2 flex items-center gap-1 sm:gap-2">
          <NavItem to="/feed">Feed</NavItem>
          <NavItem to="/leaderboard">Leaderboard</NavItem>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {loading ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-surface-container-high" />
          ) : user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container py-1 pl-1 pr-3 transition-colors hover:border-primary-container/40"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <Avatar
                  src={user.avatar_url}
                  name={user.display_name || user.handle}
                  size="sm"
                />
                <span className="metrics-font hidden text-xs text-on-surface-variant sm:inline">
                  @{user.handle}
                </span>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-48 overflow-hidden rounded-2xl border border-outline-variant/25 bg-surface-container-high py-1"
                >
                  <Link
                    role="menuitem"
                    to={`/@${user.handle}`}
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-highest"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-4 py-2.5 text-left text-sm text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                    onClick={async () => {
                      setMenuOpen(false);
                      await logout();
                      navigate("/");
                    }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/auth"
              className="rounded-xl bg-primary-container px-3.5 py-1.5 text-sm font-semibold text-on-primary transition-transform active:scale-[0.98]"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function NavItem({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
          isActive
            ? "text-primary"
            : "text-on-surface-variant hover:text-on-surface"
        )
      }
    >
      {children}
    </NavLink>
  );
}
