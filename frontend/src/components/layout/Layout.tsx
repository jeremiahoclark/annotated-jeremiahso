import { useEffect } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function Layout() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!embed && <Header />}
      <main className="flex-1">
        <Outlet />
      </main>
      {!embed && <Footer />}
    </div>
  );
}
