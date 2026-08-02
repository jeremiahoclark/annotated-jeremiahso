import { describe, it, expect } from "vitest";
import { canonicalizeUrl, randomBase32, slugify } from "../src/db";

describe("canonicalizeUrl", () => {
  it("lowercases host and path", () => {
    expect(canonicalizeUrl("https://Example.COM/Path/Page")).toBe(
      "example.com/path/page"
    );
  });

  it("strips utm_* fbclid gclid and fragment", () => {
    expect(
      canonicalizeUrl(
        "https://example.com/a?utm_source=x&id=1&fbclid=abc&gclid=z#section"
      )
    ).toBe("example.com/a?id=1");
  });

  it("trims trailing slash (not root)", () => {
    expect(canonicalizeUrl("https://example.com/foo/")).toBe(
      "example.com/foo"
    );
    expect(canonicalizeUrl("https://example.com/")).toBe("example.com/");
  });

  it("rejects non-http", () => {
    expect(() => canonicalizeUrl("ftp://x.com")).toThrow();
    expect(() => canonicalizeUrl("not url")).toThrow();
  });
});

describe("randomBase32 / slugify", () => {
  it("generates 6-char base32", () => {
    const s = randomBase32(6);
    expect(s).toHaveLength(6);
    expect(s).toMatch(/^[a-z2-7]+$/);
  });
  it("slugifies titles", () => {
    expect(slugify("Hello World!")).toBe("hello-world");
  });

  it("truncates at word boundary, never mid-word", () => {
    // Would be "foundations-of-modern-thought" — hard-slice at 12 is "foundations-"
    expect(slugify("Foundations of Modern Thought", 12)).toBe("foundations");
    expect(slugify("Foundations of Modern Thought", 12)).not.toMatch(/-$/);
    expect(slugify("the foundations of criticism", 18)).toBe("the-foundations");
  });

  it("hard-truncates a single long word without trailing dash", () => {
    expect(slugify("supercalifragilistic", 10)).toBe("supercalif");
    expect(slugify("supercalifragilistic", 10)).not.toMatch(/-$/);
  });
});
