import { describe, expect, it } from "vitest";
import { type JobPage, nextOffset } from "@/hooks/use-jobs-query";
import type { JobDto } from "@/lib/job";
import { COUNT_CAP, DEFAULT_LIMIT, MAX_OFFSET } from "@/lib/search-params";

function page(size: number, total: number | null = null): JobPage {
  return { jobs: Array.from({ length: size }, () => ({}) as JobDto), total };
}

function fullPages(count: number, total: number): JobPage[] {
  return [
    page(DEFAULT_LIMIT, total),
    ...Array.from({ length: count - 1 }, () => page(DEFAULT_LIMIT)),
  ];
}

describe("nextOffset", () => {
  it("asks for the next page while more results remain", () => {
    const pages = fullPages(1, 120);
    expect(nextOffset(pages[0] as JobPage, pages)).toBe(DEFAULT_LIMIT);
  });

  it("stops after a short page", () => {
    const pages = [page(DEFAULT_LIMIT, 70), page(20)];
    expect(nextOffset(page(20), pages)).toBeUndefined();
  });

  it("stops at an exact total from the first page instead of fetching an empty page", () => {
    const pages = fullPages(2, DEFAULT_LIMIT * 2);
    expect(nextOffset(pages[1] as JobPage, pages)).toBeUndefined();
  });

  it("keeps paging past a capped total, which only means at least that many", () => {
    const pages = fullPages(COUNT_CAP / DEFAULT_LIMIT, COUNT_CAP);
    expect(nextOffset(pages.at(-1) as JobPage, pages)).toBe(COUNT_CAP);
  });

  it("stops past the deepest offset the API serves", () => {
    const pages = fullPages(MAX_OFFSET / DEFAULT_LIMIT + 1, COUNT_CAP);
    expect(nextOffset(pages.at(-1) as JobPage, pages)).toBeUndefined();
  });
});
