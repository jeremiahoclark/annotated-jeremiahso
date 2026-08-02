import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FeedList } from "./FeedList";
import { mockFeedItem, mockFeedItem2 } from "@/test/fixtures";
import { AuthProvider } from "@/auth/auth-context";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("@/lib/api", () => ({
  api: {
    me: vi.fn().mockRejectedValue(new Error("unauth")),
    feed: vi.fn(),
    vote: vi.fn(),
  },
  ApiClientError: class ApiClientError extends Error {
    status: number;
    constructor(status: number, body: { error: string }) {
      super(body.error);
      this.status = status;
    }
  },
}));

function wrap(ui: React.ReactNode) {
  return (
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>{ui}</ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("FeedList", () => {
  it("renders items from provided feed data", () => {
    render(
      wrap(
        <FeedList
          items={[mockFeedItem, mockFeedItem2]}
          loading={false}
        />
      )
    );

    expect(screen.getByText("Interesting podcast take")).toBeInTheDocument();
    expect(screen.getByText("Another take")).toBeInTheDocument();
    expect(
      screen.getByText(/This moment reframes the entire debate/)
    ).toBeInTheDocument();
    expect(screen.getByTestId("feed-list")).toBeInTheDocument();
  });

  it("shows empty state when no items", () => {
    render(wrap(<FeedList items={[]} loading={false} />));
    expect(screen.getByText("No annotations yet")).toBeInTheDocument();
  });
});
