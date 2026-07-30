import { describe, expect, it } from "vitest";
import { normalizeLocation } from "@/lib/normalize";

describe("normalizeLocation", () => {
  it("returns unknown for empty input", () => {
    expect(normalizeLocation("")).toBe("unknown");
    expect(normalizeLocation("   ")).toBe("unknown");
  });

  it("trims and lowercases whitespace", () => {
    expect(normalizeLocation("  San Francisco  ")).toBe("san francisco");
  });

  describe("remote locations", () => {
    it("collapses every remote variant into one bucket", () => {
      expect(normalizeLocation("Remote")).toBe("remote");
      expect(normalizeLocation("remote")).toBe("remote");
      expect(normalizeLocation("Remote, US")).toBe("remote");
      expect(normalizeLocation("Remote, United States")).toBe("remote");
      expect(normalizeLocation("Remote - United Kingdom")).toBe("remote");
      expect(normalizeLocation("REMOTE — India")).toBe("remote");
    });
  });

  describe("non-remote locations", () => {
    it("lowercases city and country", () => {
      expect(normalizeLocation("Bangalore, India")).toBe("bangalore, india");
      expect(normalizeLocation("San Francisco, CA")).toBe("san francisco, ca");
    });

    it("handles Bay Area locations", () => {
      expect(normalizeLocation("San Francisco Bay Area")).toBe("san francisco bay area");
    });

    it("drops stray remote segments and duplicate segments", () => {
      expect(normalizeLocation("California, USA, Remote")).toBe("california, usa");
      expect(normalizeLocation("New York, New York, USA")).toBe("new york, usa");
      expect(normalizeLocation("Singapore, Singapore")).toBe("singapore");
      expect(normalizeLocation("Chile, Remote")).toBe("chile");
    });
  });

  describe("multi-location strings", () => {
    it("takes the first location only", () => {
      expect(normalizeLocation("Remote, Canada; Remote, United States")).toBe("remote");
      expect(normalizeLocation("San Francisco; New York")).toBe("san francisco");
    });
  });
});
