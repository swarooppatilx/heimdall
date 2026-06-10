import { describe, expect, it } from "vitest";
import { normalizeLocation } from "./normalize";

describe("normalizeLocation", () => {
  it("returns Unknown for empty input", () => {
    expect(normalizeLocation("")).toBe("Unknown");
    expect(normalizeLocation("   ")).toBe("Unknown");
  });

  it("trims whitespace", () => {
    expect(normalizeLocation("  San Francisco  ")).toBe("San Francisco");
  });

  describe("remote locations", () => {
    it("normalizes Remote with country abbreviation", () => {
      expect(normalizeLocation("Remote, US")).toBe("Remote — United States");
      expect(normalizeLocation("Remote, USA")).toBe("Remote — United States");
      expect(normalizeLocation("Remote, UK")).toBe("Remote — United Kingdom");
      expect(normalizeLocation("Remote, UAE")).toBe("Remote — United Arab Emirates");
      expect(normalizeLocation("Remote, KSA")).toBe("Remote — Saudi Arabia");
    });

    it("normalizes Remote with full country name", () => {
      expect(normalizeLocation("Remote, United States")).toBe("Remote — United States");
      expect(normalizeLocation("Remote, Canada")).toBe("Remote — Canada");
    });

    it("normalizes Remote with dash separator", () => {
      expect(normalizeLocation("Remote - US")).toBe("Remote — United States");
      expect(normalizeLocation("Remote - United Kingdom")).toBe("Remote — United Kingdom");
    });

    it("normalizes Remote without country", () => {
      expect(normalizeLocation("Remote")).toBe("Remote");
      expect(normalizeLocation("remote")).toBe("Remote");
    });

    it("title-cases country names", () => {
      expect(normalizeLocation("Remote, india")).toBe("Remote — India");
      expect(normalizeLocation("Remote, GERMANY")).toBe("Remote — Germany");
    });
  });

  describe("non-remote locations", () => {
    it("preserves city and country", () => {
      expect(normalizeLocation("Bangalore, India")).toBe("Bangalore, India");
      expect(normalizeLocation("San Francisco, CA")).toBe("San Francisco, CA");
    });

    it("handles Bay Area locations", () => {
      expect(normalizeLocation("San Francisco Bay Area")).toBe("San Francisco Bay Area");
    });
  });

  describe("multi-location strings", () => {
    it("takes the first location only", () => {
      expect(normalizeLocation("Remote, Canada; Remote, United States")).toBe("Remote — Canada");
      expect(normalizeLocation("San Francisco; New York")).toBe("San Francisco");
    });
  });
});
