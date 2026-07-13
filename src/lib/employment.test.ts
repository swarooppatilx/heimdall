import { describe, expect, it } from "vitest";
import { resolveEmploymentType } from "./employment";

describe("resolveEmploymentType", () => {
  it("maps live provider variants onto standard enums", () => {
    const fullTime = [
      "fulltime",
      "full time",
      "full-time",
      "regular",
      "regular - unlimited",
      "salaried employee",
      "full-time - new",
      "full-time- backfill",
      "permanent employee = fte (including eor)",
    ];
    for (const raw of fullTime) {
      expect(resolveEmploymentType(raw)).toBe("full time");
    }
  });

  it("resolves every enum", () => {
    expect(resolveEmploymentType("part time")).toBe("part time");
    expect(resolveEmploymentType("contract")).toBe("contractor");
    expect(resolveEmploymentType("contractor")).toBe("contractor");
    expect(resolveEmploymentType("temporary (fixed term)")).toBe("temporary");
    expect(resolveEmploymentType("intern")).toBe("intern");
    expect(resolveEmploymentType("working student")).toBe("intern");
  });

  it("returns undefined for empty or unknown values", () => {
    expect(resolveEmploymentType("")).toBeUndefined();
    expect(resolveEmploymentType(undefined)).toBeUndefined();
    expect(resolveEmploymentType("unknown")).toBeUndefined();
  });
});
