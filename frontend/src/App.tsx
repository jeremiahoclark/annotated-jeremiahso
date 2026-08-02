import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/auth/auth-context";
import { ToastProvider } from "@/components/ui/Toast";
import { Layout } from "@/components/layout/Layout";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { LandingPage } from "@/pages/LandingPage";
import { FeedPage } from "@/pages/FeedPage";
import { AnnotationPage } from "@/pages/AnnotationPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { LeaderboardPage } from "@/pages/LeaderboardPage";
import { AuthPage } from "@/pages/AuthPage";
import {
  AuthExtensionStartPage,
  AuthExtensionCompletePage,
} from "@/pages/AuthExtensionPages";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { FairUsePage } from "@/pages/FairUsePage";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<LandingPage />} />
                <Route path="feed" element={<FeedPage />} />
                <Route path="a/:slug" element={<AnnotationPage />} />
                <Route path="@:handle" element={<ProfilePage />} />
                <Route path="u/:handle" element={<ProfilePage />} />
                <Route path="leaderboard" element={<LeaderboardPage />} />
                <Route path="auth" element={<AuthPage />} />
                <Route
                  path="auth/extension/start"
                  element={<AuthExtensionStartPage />}
                />
                <Route
                  path="auth/extension/complete"
                  element={<AuthExtensionCompletePage />}
                />
                <Route path="fair-use-static" element={<FairUsePage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
