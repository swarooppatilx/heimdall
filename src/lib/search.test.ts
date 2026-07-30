import { describe, expect, it } from "vitest";
import { buildMatchQuery } from "@/lib/search";

describe("buildMatchQuery", () => {
  it("quotes tokens and prefixes the last for search", () => {
    expect(buildMatchQuery("backend engineer")).toBe('"backend" "engineer"*');
  });

  it("escapes embedded quotes", () => {
    expect(buildMatchQuery('foo"bar')).toBe('"foo""bar"*');
  });

  it("drops tokens without letters or numbers", () => {
    expect(buildMatchQuery("rust +++ --")).toBe('"rust"*');
    expect(buildMatchQuery("+++ ---")).toBe("");
  });

  it("returns empty for blank input", () => {
    expect(buildMatchQuery("   ")).toBe("");
  });

  it("treats hyphenated input as an adjacent phrase", () => {
    expect(buildMatchQuery("full-time")).toBe('"full-time"*');
  });
});
