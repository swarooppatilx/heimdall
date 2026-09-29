import { describe, expect, it } from "vitest";
import { companyFromSlug, sanitizeFilterValue } from "@/server/jobs/sanitize";

describe("sanitizeFilterValue", () => {
  it("lowercases and strips bracketed suffixes", () => {
    expect(sanitizeFilterValue("Cursor (Anysphere)")).toBe("cursor");
    expect(sanitizeFilterValue("Slack (Salesforce)")).toBe("slack");
  });

  it("replaces separators with spaces but keeps allowed punctuation", () => {
    expect(sanitizeFilterValue("customer.io")).toBe("customer.io");
    expect(sanitizeFilterValue("data & analytics")).toBe("data & analytics");
    expect(sanitizeFilterValue("washington d.c.")).toBe("washington d.c.");
    expect(sanitizeFilterValue("hewlett-packard")).toBe("hewlett packard");
  });

  it("collapses whitespace left by removals", () => {
    expect(sanitizeFilterValue("  Acme   Corp (formerly X) ")).toBe("acme corp");
  });
});

describe("companyFromSlug", () => {
  it("matches a title-cased company url to the stored name", () => {
    expect(companyFromSlug("Apple")).toBe("apple");
    expect(companyFromSlug("Scale%20AI")).toBe("scale ai");
    expect(companyFromSlug("scale+ai")).toBe("scale ai");
  });

  it("returns an empty name for a malformed escape", () => {
    expect(companyFromSlug("%E0%A4%A")).toBe("");
  });
});

describe("sanitize filter contract", () => {
  it("normalizes enum params the same way ingestion does", () => {
    expect(sanitizeFilterValue("Senior")).toBe("senior");
    expect(sanitizeFilterValue("data & analytics")).toBe("data & analytics");
    expect(sanitizeFilterValue("customer-support")).toBe("customer support");
  });
});
