import { describe, expect, it } from "vitest";
import {
  clearedFilters,
  EMPTY_HOME_FILTERS,
  parseHomeFilters,
  parseJobSearchParams,
  toJobFilters,
} from "@/lib/search-params";

function parse(query: string) {
  return parseJobSearchParams(new URLSearchParams(query));
}

describe("parseJobSearchParams", () => {
  it("maps query params onto filters and page options", () => {
    expect(parse("q=react&department=design&limit=20&offset=40")).toEqual({
      ok: true,
      filters: { q: "react", department: "design" },
      page: { limit: 20, offset: 40 },
    });
  });

  it("drops blank values", () => {
    expect(parse("q=%20%20&company=")).toEqual({ ok: true, filters: {}, page: {} });
  });

  it("rejects oversized search terms and filter values", () => {
    expect(parse(`q=${"a".repeat(201)}`)).toEqual({ ok: false, error: "param_too_long" });
    expect(parse(`company=${"a".repeat(101)}`)).toEqual({ ok: false, error: "param_too_long" });
  });

  it("rejects unknown posted windows and deep offsets", () => {
    expect(parse("posted=month")).toEqual({ ok: false, error: "invalid_posted" });
    expect(parse("offset=10001")).toEqual({ ok: false, error: "offset_too_large" });
  });
});

describe("parseHomeFilters", () => {
  it("keeps valid filters when another value in the link is invalid", () => {
    const filters = parseHomeFilters(new URLSearchParams("company=stripe&level=staff"));
    expect(filters.company).toBe("stripe");
    expect(filters.level).toBe("");
  });

  it("drops an unknown sort so the sort menu always has a selection", () => {
    expect(parseHomeFilters(new URLSearchParams("sort=salary")).sort).toBe("");
    expect(parseHomeFilters(new URLSearchParams("sort=company")).sort).toBe("company");
  });

  it("keeps only the fields the homepage controls, as strings", () => {
    const filters = parseHomeFilters(
      new URLSearchParams("q=go&city=berlin&posted=week&level=entry"),
    );
    expect(filters).toEqual({
      q: "go",
      company: "",
      location: "",
      level: "entry",
      department: "",
      sort: "",
    });
    expect(toJobFilters(filters)).toEqual({ q: "go", level: "entry" });
  });

  it("falls back to no filters when the params are invalid", () => {
    expect(toJobFilters(parseHomeFilters(new URLSearchParams("level=staff")))).toEqual({});
  });
});

describe("clearedFilters", () => {
  it("drops every filter but keeps the chosen sort", () => {
    const filters = { ...EMPTY_HOME_FILTERS, q: "rust", company: "stripe", sort: "company" };
    expect(clearedFilters(filters)).toEqual({ ...EMPTY_HOME_FILTERS, sort: "company" });
  });
});
