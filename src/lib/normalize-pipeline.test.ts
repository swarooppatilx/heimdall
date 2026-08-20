import { describe, expect, it } from "vitest";
import { formatPlace, resolvePlace } from "@/lib/gazetteer";
import { normalizeLocation } from "@/lib/normalize";

function pipeline(raw: string): string {
  const normalized = normalizeLocation(raw);
  const place = resolvePlace(normalized);
  return place ? formatPlace(place) : normalized;
}

describe("location normalization pipeline", () => {
  it("normalizes city aliases to canonical form", () => {
    expect(pipeline("Bangalore")).toBe("bengaluru, india");
    expect(pipeline("Bengaluru, India")).toBe("bengaluru, india");
  });

  it("lowercases all outputs", () => {
    expect(pipeline("San Francisco, CA")).toBe("san francisco, united states");
    expect(pipeline("New York, NY")).toBe("new york, united states");
  });

  it("handles remote locations", () => {
    expect(pipeline("Remote")).toBe("remote");
    expect(pipeline("Remote, US")).toBe("united states");
    expect(pipeline("REMOTE — India")).toBe("india");
  });

  it("deduplicates redundant segments", () => {
    expect(pipeline("Singapore, Singapore")).toBe("singapore, singapore");
    expect(pipeline("New York, New York, USA")).toBe("new york, united states");
  });

  it("strips leading remote prefix and resolves remaining city", () => {
    expect(pipeline("Remote, Canada; Remote, United States")).toBe("canada");
  });

  it("falls back to country when no city match", () => {
    expect(pipeline("Germany")).toBe("germany");
    expect(pipeline("Ontario, Canada")).toBe("canada");
  });

  it("returns unknown for empty input, passes through garbage", () => {
    expect(pipeline("")).toBe("unknown");
    expect(pipeline("   ")).toBe("unknown");
    expect(pipeline("n/a")).toBe("n/a");
  });

  it("preserves lowercase through the entire pipeline", () => {
    const inputs = [
      "Bangalore, India",
      "Remote, United States",
      "São Paulo, Brazil",
      "Zürich, Switzerland",
    ];
    for (const raw of inputs) {
      const result = pipeline(raw);
      expect(result).toBe(result.toLowerCase());
    }
  });
});
