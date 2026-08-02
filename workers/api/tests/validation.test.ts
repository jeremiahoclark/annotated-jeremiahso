import { describe, it, expect } from "vitest";
import {
  wordCount,
  validateClipText,
  validateClipWindow,
  validateCommentary,
  validateSourceUrl,
  validateSourceType,
  validateCommentBody,
  validateReportReason,
  validateVoteValue,
  ValidationError,
} from "../src/validation";

describe("wordCount / clip_text", () => {
  it("counts whitespace tokens", () => {
    expect(wordCount("one two three")).toBe(3);
    expect(wordCount("  a  b  ")).toBe(2);
    expect(wordCount("")).toBe(0);
  });

  it("allows exactly 100 words", () => {
    const text = Array.from({ length: 100 }, (_, i) => `w${i}`).join(" ");
    expect(() => validateClipText(text)).not.toThrow();
  });

  it("rejects 101 words with CLIP_TOO_LONG", () => {
    const text = Array.from({ length: 101 }, (_, i) => `w${i}`).join(" ");
    expect(() => validateClipText(text)).toThrow(ValidationError);
    try {
      validateClipText(text);
    } catch (e) {
      expect((e as ValidationError).code).toBe("CLIP_TOO_LONG");
    }
  });
});

describe("clip window", () => {
  it("allows exactly 90 seconds", () => {
    expect(() => validateClipWindow("video", 0, 90)).not.toThrow();
    expect(() => validateClipWindow("audio", 10, 100)).not.toThrow();
  });

  it("rejects 90.1 seconds with CLIP_WINDOW_INVALID", () => {
    expect(() => validateClipWindow("video", 0, 90.1)).toThrow(ValidationError);
    try {
      validateClipWindow("video", 0, 90.1);
    } catch (e) {
      expect((e as ValidationError).code).toBe("CLIP_WINDOW_INVALID");
    }
  });

  it("rejects zero/negative duration", () => {
    expect(() => validateClipWindow("video", 5, 5)).toThrow(ValidationError);
    expect(() => validateClipWindow("video", 10, 5)).toThrow(ValidationError);
  });

  it("requires window for video/audio", () => {
    expect(() => validateClipWindow("video", null, null)).toThrow(
      ValidationError
    );
  });

  it("allows missing window for article", () => {
    expect(() => validateClipWindow("article", null, null)).not.toThrow();
  });
});

describe("commentary", () => {
  it("requires 10 non-whitespace chars", () => {
    expect(() => validateCommentary("short")).toThrow(ValidationError);
    expect(() => validateCommentary("   a b c   ")).toThrow(ValidationError);
    try {
      validateCommentary("tiny");
    } catch (e) {
      expect((e as ValidationError).code).toBe("COMMENTARY_REQUIRED");
    }
    expect(validateCommentary("0123456789")).toBe("0123456789");
    expect(validateCommentary("  twelve chars here  ").length).toBeGreaterThan(
      9
    );
  });
});

describe("source url/type", () => {
  it("accepts https urls", () => {
    expect(validateSourceUrl("https://example.com/x")).toContain("https://");
  });
  it("rejects non-http", () => {
    expect(() => validateSourceUrl("ftp://x.com")).toThrow(ValidationError);
    expect(() => validateSourceUrl("not-a-url")).toThrow(ValidationError);
  });
  it("validates source_type enum", () => {
    expect(validateSourceType("video")).toBe("video");
    expect(() => validateSourceType("pdf")).toThrow(ValidationError);
  });
});

describe("comment / report / vote", () => {
  it("comment body 1..1000", () => {
    expect(() => validateCommentBody("")).toThrow(ValidationError);
    expect(validateCommentBody("hi")).toBe("hi");
    expect(() => validateCommentBody("x".repeat(1001))).toThrow(
      ValidationError
    );
  });
  it("report reasons", () => {
    expect(validateReportReason("copyright_concern")).toBe(
      "copyright_concern"
    );
    expect(() => validateReportReason("spam")).toThrow(ValidationError);
  });
  it("vote values", () => {
    expect(validateVoteValue(1)).toBe(1);
    expect(validateVoteValue(-1)).toBe(-1);
    expect(validateVoteValue(0)).toBe(0);
    expect(() => validateVoteValue(2)).toThrow(ValidationError);
  });
});
