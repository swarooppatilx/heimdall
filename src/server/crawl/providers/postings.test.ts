import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Job } from "@/lib/job";
import { mapPostings } from "@/server/crawl/providers/postings";

const postingSchema = z.object({ id: z.string(), remote: z.boolean().nullish() });

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
    const result = mapPostings(
      [{ id: "1" }, { id: "2", remote: null }],
      "acme",
      postingSchema,
      (p) => job(p.id),
    );
    expect(result).toHaveLength(2);
  });

  it("skips invalid postings instead of failing the board, logging one summary", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = mapPostings(
      [{ id: "1" }, { id: 2 }, null, { id: "4" }],
      "acme",
      postingSchema,
      (p) => job(p.id),
    );

    expect(result.map((j) => j.id)).toEqual(["1", "4"]);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(logged).toMatchObject({ event: "postings_skipped", company: "acme", skipped: 2 });
    expect(logged.reason).toContain("id");
  });

  it("skips postings whose mapper throws", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = mapPostings([{ id: "1" }, { id: "bad" }], "acme", postingSchema, (p) => {
      if (p.id === "bad") throw new Error("missing posting date");
      return job(p.id);
    });
    expect(result.map((j) => j.id)).toEqual(["1"]);
  });

  it("tolerates a missing posting list", () => {
    expect(mapPostings(undefined, "acme", postingSchema, (p) => job(p.id))).toEqual([]);
    expect(mapPostings(null, "acme", postingSchema, (p) => job(p.id))).toEqual([]);
  });
});
