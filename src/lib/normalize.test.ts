import { describe, expect, it } from "vitest";
import { normalizeLocation, regionFromLocation } from "./normalize";

describe("normalizeLocation", () => {
  it("returns unknown for empty input", () => {
    expect(normalizeLocation("")).toBe("unknown");
    expect(normalizeLocation("   ")).toBe("unknown");
  });

  it("trims and lowercases whitespace", () => {
    expect(normalizeLocation("  San Francisco  ")).toBe("san francisco");
  });

  describe("remote locations", () => {
    it("normalizes Remote with country abbreviation", () => {
      expect(normalizeLocation("Remote, US")).toBe("remote — united states");
      expect(normalizeLocation("Remote, USA")).toBe("remote — united states");
      expect(normalizeLocation("Remote, UK")).toBe("remote — united kingdom");
      expect(normalizeLocation("Remote, UAE")).toBe("remote — united arab emirates");
      expect(normalizeLocation("Remote, KSA")).toBe("remote — saudi arabia");
    });

    it("normalizes Remote with full country name", () => {
      expect(normalizeLocation("Remote, United States")).toBe("remote — united states");
      expect(normalizeLocation("Remote, Canada")).toBe("remote — canada");
    });

    it("normalizes Remote with dash separator", () => {
      expect(normalizeLocation("Remote - US")).toBe("remote — united states");
      expect(normalizeLocation("Remote - United Kingdom")).toBe("remote — united kingdom");
    });

    it("normalizes Remote without country", () => {
      expect(normalizeLocation("Remote")).toBe("remote");
      expect(normalizeLocation("remote")).toBe("remote");
    });

    it("title-cases country names then lowercases", () => {
      expect(normalizeLocation("Remote, india")).toBe("remote — india");
      expect(normalizeLocation("Remote, GERMANY")).toBe("remote — germany");
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
  });

  describe("multi-location strings", () => {
    it("takes the first location only", () => {
      expect(normalizeLocation("Remote, Canada; Remote, United States")).toBe("remote — canada");
      expect(normalizeLocation("San Francisco; New York")).toBe("san francisco");
    });
  });
});

describe("regionFromLocation", () => {
  it("extracts the country from the last segment", () => {
    expect(regionFromLocation("New York, New York, USA")).toBe("united states");
    expect(regionFromLocation("London, United Kingdom")).toBe("united kingdom");
    expect(regionFromLocation("Bangalore, India")).toBe("india");
  });

  it("strips remote prefixes and suffixes", () => {
    expect(regionFromLocation("Remote — India")).toBe("india");
    expect(regionFromLocation("Remote, US")).toBe("united states");
    expect(regionFromLocation("California, USA, Remote")).toBe("united states");
    expect(regionFromLocation("Remote")).toBe("");
  });

  it("returns empty for empty input", () => {
    expect(regionFromLocation("")).toBe("");
  });

  it("title-cases unknown countries", () => {
    expect(regionFromLocation("Sao Paulo, Brazil")).toBe("brazil");
    expect(regionFromLocation("Ljubljana")).toBe("ljubljana");
  });
});
