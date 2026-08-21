import { describe, expect, it } from "vitest";
import { resolveEmploymentType } from "@/lib/employment";
import { resolvePlace } from "@/lib/gazetteer";
import { escapeLike } from "@/lib/job-queries";
import { sanitizeFilterValue } from "@/lib/sanitize";

describe("escapeLike", () => {
  it("escapes percent sign", () => {
    expect(escapeLike("100%")).toBe("100\\%");
  });

  it("escapes underscore", () => {
    expect(escapeLike("node_js")).toBe("node\\_js");
  });

  it("escapes backslash", () => {
    expect(escapeLike("path\\to")).toBe("path\\\\to");
  });

  it("escapes multiple special characters", () => {
    expect(escapeLike("%_\\test")).toBe("\\%\\_\\\\test");
  });

  it("passes through plain text unchanged", () => {
    expect(escapeLike("software engineer")).toBe("software engineer");
  });
});

describe("locationCondition branching", () => {
  it("returns undefined for empty value", () => {
    expect(locationBranch(undefined)).toBeUndefined();
    expect(locationBranch("")).toBeUndefined();
  });

  it("detects remote locations", () => {
    expect(locationBranch("remote")).toEqual({ type: "remote" });
    expect(locationBranch("Remote, US")).toEqual({ type: "remote" });
  });

  it("detects city-level locations", () => {
    const result = locationBranch("bengaluru, india");
    expect(result?.type).toBe("facet");
    expect(result?.city).toBe("bengaluru");
  });

  it("falls back to like for unrecognized input", () => {
    const result = locationBranch("zzz_nonexistent_place");
    expect(result?.type).toBe("like");
  });
});

describe("companyCondition", () => {
  it("returns undefined for empty value", () => {
    expect(companyBranch(undefined)).toBeUndefined();
    expect(companyBranch("")).toBeUndefined();
  });

  it("lowercases and sanitizes company name", () => {
    expect(companyBranch("Stripe")).toEqual({ type: "eq", value: "stripe" });
  });
});

describe("employmentTypeCondition", () => {
  it("returns undefined for empty value", () => {
    expect(employmentBranch(undefined)).toBeUndefined();
    expect(employmentBranch("")).toBeUndefined();
  });

  it("resolves employment type aliases", () => {
    expect(employmentBranch("fulltime")).toEqual({ type: "eq", value: "full time" });
  });
});

function locationBranch(value: string | undefined) {
  if (!value) return undefined;
  const place = resolvePlace(value);
  if (place?.remote) return { type: "remote" as const };
  if (place?.city) return { type: "facet" as const, city: place.city, country: place.country };
  if (place?.country) return { type: "facet" as const, country: place.country };
  return { type: "like" as const, value };
}

function companyBranch(value: string | undefined) {
  if (!value) return undefined;
  return { type: "eq" as const, value: sanitizeFilterValue(value) };
}

function employmentBranch(value: string | undefined) {
  if (!value) return undefined;
  const sanitized = sanitizeFilterValue(value);
  return { type: "eq" as const, value: resolveEmploymentType(sanitized) ?? sanitized };
}
