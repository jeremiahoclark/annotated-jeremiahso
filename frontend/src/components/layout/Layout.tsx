import { Outlet, ScrollRestoration, useSearchParams } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function Layout() {
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ScrollRestoration />
      {!embed && <Header />}
      <main className="flex-1">
        <Outlet />
      </main>
      {!embed && <Footer />}
    </div>
  );
}
