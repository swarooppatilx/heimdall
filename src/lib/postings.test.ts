import { afterEach, describe, expect, it, vi } from "vitest";
import type { Job } from "@/lib/job";
import { mapPostings } from "./postings";

function job(id: string): Job {
  return {
    id,
    title: `Role ${id}`,
    company: "acme",
    location: "remote",
    department: "engineering",
    url: `https://example.com/${id}`,
    postedAt: new Date("2026-08-20"),
    source: "greenhouse",
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mapPostings", () => {
  it("maps every posting when all are well-formed", () => {
    const result = mapPostings([{ id: "1" }, { id: "2" }], "acme", (p) => job(p.id));
    expect(result).toHaveLength(2);
  });

  it("skips postings whose mapper throws and logs the count", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = mapPostings(
      [{ id: "1" }, null, { id: "3" }] as { id: string }[],
      "acme",
      (p) => {
        if (p === null) throw new Error("malformed");
        return job(p.id);
      },
    );

    expect(result.map((j) => j.id)).toEqual(["1", "3"]);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("postings_skipped"));
  });

  it("tolerates an undefined posting list", () => {
    const result = mapPostings(undefined, "acme", () => job("1"));
    expect(result).toEqual([]);
  });
});
