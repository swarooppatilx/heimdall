import { describe, expect, it } from "vitest";
import { chunk } from "@/lib/chunk";

describe("chunk", () => {
  it("splits items into pages with a short last page", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns no pages for an empty list", () => {
    expect(chunk([], 90)).toEqual([]);
  });
});
