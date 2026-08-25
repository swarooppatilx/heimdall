import { beforeEach, describe, expect, it, vi } from "vitest";
import { crawlAll, crawlSlices, shouldRunTick, sweepSlice } from "@/lib/crawler";
import { createCrawlBudget } from "@/lib/http";
import type { Job } from "@/lib/job";

const { fetchJobsMock, getJobsByBoardMock, deleteJobsByIdsMock } = vi.hoisted(() => ({
  fetchJobsMock: vi.fn(),
  getJobsByBoardMock: vi.fn(),
  deleteJobsByIdsMock: vi.fn(),
}));

vi.mock("./fetch-jobs", () => ({
  fetchJobs: (...args: unknown[]) => fetchJobsMock(...args),
}));

vi.mock("./db", () => ({
  deleteJobsByIds: (...args: unknown[]) => deleteJobsByIdsMock(...args),
  getJobsByBoard: (...args: unknown[]) => getJobsByBoardMock(...args),
  insertJobs: vi.fn(async () => {}),
  recordCrawl: vi.fn(async () => {}),
  updateJobs: vi.fn(async () => {}),
}));

vi.mock("@/lib/registry", () => ({
  getRegistry: () => [
    { name: "c0", provider: "greenhouse" },
    { name: "c1", provider: "greenhouse" },
  ],
}));

function makeJob(id: string): Job {
  return {
    id,
    title: `Role ${id}`,
    company: "c0",
    location: "remote",
    department: "engineering",
    url: `https://example.com/${id}`,
    postedAt: new Date("2026-08-20"),
    source: "greenhouse",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchJobsMock.mockImplementation((_entry: unknown, budget?: { used: number }) => {
    if (budget) budget.used += 1;
    return Promise.resolve([]);
  });
  getJobsByBoardMock.mockResolvedValue([]);
});

const TICK_MS = 30 * 60 * 1000;

describe("shouldRunTick", () => {
  it("runs when no crawl has ever been recorded", () => {
    expect(shouldRunTick(null, Date.now())).toBe(true);
  });

  it("skips when the previous crawl is still within the tick window", () => {
    const now = 1_755_000_000_000;
    expect(shouldRunTick(now - 60_000, now)).toBe(false);
    expect(shouldRunTick(now - 5 * 60_000, now)).toBe(false);
  });

  it("runs once enough time has passed since the last crawl", () => {
    const now = 1_755_000_000_000;
    expect(shouldRunTick(now - (TICK_MS - 2 * 60_000), now)).toBe(true);
    expect(shouldRunTick(now - TICK_MS, now)).toBe(true);
  });
});

const registry = Array.from({ length: 19 }, (_, i) => ({
  name: `c${i}`,
  provider: "greenhouse",
}));

function sweep(ticks = 16): string[] {
  const seen: string[] = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    for (const entry of sweepSlice(registry, tick * 30 * 60 * 1000)) {
      seen.push(entry.name);
    }
  }
  return seen;
}

describe("sweepSlice", () => {
  it("covers every company exactly once per full sweep", () => {
    const seen = sweep();
    expect(seen).toHaveLength(registry.length);
    expect(new Set(seen).size).toBe(registry.length);
  });

  it("keeps slice sizes within one of each other", () => {
    const sizes: number[] = [];
    for (let tick = 0; tick < 16; tick += 1) {
      sizes.push(sweepSlice(registry, tick * 30 * 60 * 1000).length);
    }
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it("is deterministic within a tick", () => {
    const aligned = 1_755_000_000_000 - (1_755_000_000_000 % (30 * 60 * 1000));
    expect(sweepSlice(registry, aligned)).toEqual(sweepSlice(registry, aligned + 60_000));
  });

  it("handles registries smaller than the tick count without duplicates", () => {
    const small = registry.slice(0, 3);
    const seen: string[] = [];
    for (let tick = 0; tick < 16; tick += 1) {
      for (const entry of sweepSlice(small, tick * 30 * 60 * 1000)) {
        seen.push(entry.name);
      }
    }
    expect(new Set(seen).size).toBe(3);
  });
});

describe("crawlAll", () => {
  it("crawls every entry when budget is available", async () => {
    const run = await crawlAll(registry.slice(0, 4), createCrawlBudget());
    expect(run.results).toHaveLength(4);
    expect(run.skipped).toBe(0);
  });

  it("stops scheduling boards once the subrequest budget is spent", async () => {
    const exhausted = createCrawlBudget();
    exhausted.used = 40;
    const run = await crawlAll(registry.slice(0, 5), exhausted);
    expect(run.results).toHaveLength(0);
    expect(run.skipped).toBe(5);
  });

  it("reports skipped entries when the budget runs out mid-slice", async () => {
    const tight = createCrawlBudget();
    tight.used = 38;
    const run = await crawlAll(registry.slice(0, 6), tight);
    expect(run.results.length).toBeLessThan(6);
    expect(run.results.length + run.skipped).toBe(6);
  });

  it("propagates deletions when a board shrinks", async () => {
    const board = [makeJob("j1"), makeJob("j2"), makeJob("j3")];
    getJobsByBoardMock.mockResolvedValue(board);
    fetchJobsMock.mockImplementation((_entry: unknown, budget?: { used: number }) => {
      if (budget) budget.used += 1;
      return Promise.resolve([makeJob("j2")]);
    });

    const run = await crawlAll(registry.slice(0, 1), createCrawlBudget());

    expect(run.results[0]?.status).toBe("ok");
    expect(deleteJobsByIdsMock).toHaveBeenCalledWith(["j1", "j3"]);
  });

  it("guards against mass deletions on emptied boards", async () => {
    const board = Array.from({ length: 12 }, (_, i) => makeJob(`j${i}`));
    getJobsByBoardMock.mockResolvedValue(board);
    fetchJobsMock.mockImplementation((_entry: unknown, budget?: { used: number }) => {
      if (budget) budget.used += 1;
      return Promise.resolve([makeJob("j0")]);
    });

    const run = await crawlAll(registry.slice(0, 1), createCrawlBudget());

    expect(run.results[0]?.status).toBe("ok");
    expect(deleteJobsByIdsMock).not.toHaveBeenCalled();
  });
});

describe("crawlSlices", () => {
  it("returns one run per slice", async () => {
    const runs = await crawlSlices(2);
    expect(runs).toHaveLength(2);
  });

  it("covers the registry exactly once across a full sweep", async () => {
    const runs = await crawlSlices(16);
    const seen = runs.flatMap((run) => run.results.map((r) => r.company));
    expect(seen).toHaveLength(2);
    expect(new Set(seen).size).toBe(2);
  });
});
