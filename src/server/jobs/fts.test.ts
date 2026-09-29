import { describe, expect, it } from "vitest";
import { buildMatchQuery, jobIdMatch } from "@/server/jobs/fts";

function text(terms: string): string {
  return `{title company location department} : (${terms})`;
}

describe("buildMatchQuery", () => {
  it("prefix-matches the last token", () => {
    expect(buildMatchQuery("front")).toBe(text('"front"*'));
    expect(buildMatchQuery("senior front")).toBe(text('"senior" "front"*'));
  });

  it("escapes quotes and drops punctuation-only tokens", () => {
    expect(buildMatchQuery('c" ++ go')).toBe(text('"c""" "go"*'));
  });

  it("matches symbol tokens like c++ exactly instead of as a one-letter prefix", () => {
    expect(buildMatchQuery("c++")).toBe(text('"c++"'));
    expect(buildMatchQuery("senior c#")).toBe(text('"senior" "c#"'));
    expect(buildMatchQuery("go")).toBe(text('"go"*'));
    expect(buildMatchQuery("r")).toBe(text('"r"'));
  });

  it("returns empty for blank input", () => {
    expect(buildMatchQuery("  ")).toBe("");
  });
});

describe("jobIdMatch", () => {
  it("ORs one quoted job_id phrase per id, escaping quotes", () => {
    expect(jobIdMatch(["gh-acme-1", 'lv-o\'brien-"x"'])).toBe(
      'job_id : "gh-acme-1" OR job_id : "lv-o\'brien-""x"""',
    );
  });
});
