import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AnnotationPage } from "./AnnotationPage";
import { mockAnnotationResponse } from "@/test/fixtures";
import { AuthProvider } from "@/auth/auth-context";
import { ToastProvider } from "@/components/ui/Toast";

const getAnnotation = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    me: vi.fn().mockRejectedValue(new Error("unauth")),
    getAnnotation: (...args: unknown[]) => getAnnotation(...args),
    mediaUrl: (key: string) => `/media/${key}`,
    vote: vi.fn(),
    report: vi.fn(),
    postComment: vi.fn(),
  },
  ApiClientError: class ApiClientError extends Error {
    status: number;
    constructor(status: number, body: { error: string }) {
      super(body.error);
      this.status = status;
    }
  },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/a/demo-clip-ab12"]}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/a/:slug" element={<AnnotationPage />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("AnnotationPage", () => {
  beforeEach(() => {
    getAnnotation.mockReset();
    getAnnotation.mockResolvedValue(mockAnnotationResponse);
  });

  it("renders clip window chip, commentary, and original domain line", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("annotation-page")).toBeInTheDocument();
    });

    expect(screen.getByTestId("clip-window-chip")).toHaveTextContent(
      "0:47 → 2:17"
    );
    expect(screen.getByTestId("commentary")).toHaveTextContent(
      /This moment reframes the entire debate/
    );
    const fair = screen.getByTestId("fair-use-line");
    expect(fair).toHaveTextContent(/Approx\. 90s clip/);
    expect(fair).toHaveTextContent(/fair-use commentary\/criticism/);
    expect(fair).toHaveTextContent(/View original/);
    expect(fair).toHaveTextContent(/youtube\.com/);
  });
});
