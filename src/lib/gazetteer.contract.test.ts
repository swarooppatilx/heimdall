import { describe, expect, it } from "vitest";
import { resolvePlace } from "./gazetteer";

describe("filter matching contract", () => {
  it("collapses location aliases to canonical countries", () => {
    expect(resolvePlace("usa")?.country).toBe("united states");
    expect(resolvePlace("us")?.country).toBe("united states");
    expect(resolvePlace("United States")?.country).toBe("united states");
  });

  it("resolves city and country from combined location strings", () => {
    const place = resolvePlace("san francisco, united states");
    expect(place?.city).toBe("san francisco");
    expect(place?.country).toBe("united states");
  });

  it("marks remote variants", () => {
    expect(resolvePlace("Remote — United States")?.remote).toBe(true);
  });
});
