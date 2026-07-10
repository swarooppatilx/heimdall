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
      expect(resolveEmploymentType(raw)).toBe("FULL_TIME");
    }
  });

  it("resolves every enum", () => {
    expect(resolveEmploymentType("part time")).toBe("PART_TIME");
    expect(resolveEmploymentType("contract")).toBe("CONTRACTOR");
    expect(resolveEmploymentType("contractor")).toBe("CONTRACTOR");
    expect(resolveEmploymentType("temporary (fixed term)")).toBe("TEMPORARY");
    expect(resolveEmploymentType("intern")).toBe("INTERN");
    expect(resolveEmploymentType("working student")).toBe("INTERN");
  });

  it("returns undefined for empty or unknown values", () => {
    expect(resolveEmploymentType("")).toBeUndefined();
    expect(resolveEmploymentType(undefined)).toBeUndefined();
    expect(resolveEmploymentType("unknown")).toBeUndefined();
  });
});
