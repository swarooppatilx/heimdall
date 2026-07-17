import { describe, expect, it } from "vitest";
import { resolveEmploymentType } from "./employment";
import { resolvePlace } from "./gazetteer";
import { sanitizeFilterValue } from "./sanitize";

describe("filter value normalization", () => {
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

  it("collapses employment type variants to canonical values", () => {
    expect(resolveEmploymentType("Full-Time")).toBe("full time");
    expect(resolveEmploymentType("FULL_TIME")).toBe("full time");
    expect(resolveEmploymentType("fulltime")).toBe("full time");
    expect(resolveEmploymentType("contract")).toBe("contractor");
  });

  it("sanitizes enum params the same way ingestion does", () => {
    expect(sanitizeFilterValue("Senior")).toBe("senior");
    expect(sanitizeFilterValue("data & analytics")).toBe("data & analytics");
    expect(sanitizeFilterValue("customer-support")).toBe("customer support");
  });
});
