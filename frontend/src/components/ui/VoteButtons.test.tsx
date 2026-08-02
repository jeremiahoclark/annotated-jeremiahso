import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { VoteButtons } from "./VoteButtons";
import { AuthProvider } from "@/auth/auth-context";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("@/lib/api", () => ({
  api: {
    me: vi.fn().mockRejectedValue(new Error("unauth")),
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

describe("VoteButtons auth gate", () => {
  it("opens AuthModal when vote is clicked while logged out", async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <ToastProvider>
            <VoteButtons
              annotationId={1}
              upCount={0}
              downCount={0}
              userVote={null}
            />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // Wait for session hydrate to finish
    await waitFor(() => {
      expect(screen.getByLabelText("Upvote")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Upvote"));

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: /join the conversation/i })
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Join the conversation")).toBeInTheDocument();
  });
});
