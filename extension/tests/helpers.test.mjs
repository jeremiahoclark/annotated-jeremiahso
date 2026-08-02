import { describe, expect, it } from "vitest";
import {
  countWords,
  countNonWhitespace,
  validateClipWindow,
  extractYouTubeVideoId,
  isYouTubePageUrl,
  friendlyApiError,
} from "../src/lib/helpers.ts";

describe("countWords", () => {
  it("returns 0 for empty/whitespace", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n\t")).toBe(0);
  });

  it("splits on whitespace", () => {
    expect(countWords("one two three")).toBe(3);
    expect(countWords("  a   b  ")).toBe(2);
  });
});

describe("countNonWhitespace", () => {
  it("ignores whitespace", () => {
    expect(countNonWhitespace("a b c")).toBe(3);
    expect(countNonWhitespace("  hi  ")).toBe(2);
  });
});

describe("validateClipWindow", () => {
  it("accepts valid ≤90s window", () => {
    const r = validateClipWindow(10, 100);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.duration).toBe(90);
  });

  it("rejects end ≤ start", () => {
    const r = validateClipWindow(5, 5);
    expect(r.ok).toBe(false);
  });

  it("rejects duration > 90", () => {
    const r = validateClipWindow(0, 90.1);
    expect(r.ok).toBe(false);
  });

  it("rejects negative", () => {
    expect(validateClipWindow(-1, 10).ok).toBe(false);
  });
});

describe("extractYouTubeVideoId", () => {
  it("parses watch URLs", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("parses youtu.be", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("parses shorts", () => {
    expect(extractYouTubeVideoId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("parses embed", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("returns null for non-YouTube", () => {
    expect(extractYouTubeVideoId("https://example.com/watch?v=x")).toBeNull();
  });

  it("isYouTubePageUrl mirrors id extraction", () => {
    expect(isYouTubePageUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubePageUrl("https://example.com")).toBe(false);
  });
});

describe("friendlyApiError", () => {
  it("maps known codes", () => {
    expect(friendlyApiError("CLIP_TOO_LONG")).toMatch(/100 words/i);
    expect(friendlyApiError("CLIP_WINDOW_INVALID")).toMatch(/90/);
    expect(friendlyApiError("COMMENTARY_REQUIRED")).toMatch(/10/);
  });
});
