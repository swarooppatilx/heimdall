import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "@/lib/job";
import { createCrawlBudget } from "@/server/crawl/http";
import { crawlAll, sweepSlice, TICKS_PER_SWEEP, upcomingBoards } from "@/server/crawl/scheduler";

const { fetchJobsMock, getJobsByIdPrefixMock, deleteJobsByIdsMock, insertJobsMock } = vi.hoisted(
  () => ({
    fetchJobsMock: vi.fn(),
    getJobsByIdPrefixMock: vi.fn(),
    deleteJobsByIdsMock: vi.fn(),
    insertJobsMock: vi.fn(),
  }),
);

vi.mock("./fetch-jobs", () => ({
  fetchJobs: (...args: unknown[]) => fetchJobsMock(...args),
  boardIdPrefix: (entry: { name: string }) => `gh-${entry.name}-`,
}));

vi.mock("@/server/crawl/store", () => ({
  recordCrawl: vi.fn(async () => {}),
  getLastModified: vi.fn(async () => null),
}));

vi.mock("@/server/jobs/queries", () => ({
  getJobsByIdPrefix: (...args: unknown[]) => getJobsByIdPrefixMock(...args),
}));

vi.mock("@/server/jobs/writes", () => ({
  deleteJobsByIds: (...args: unknown[]) => deleteJobsByIdsMock(...args),
  insertJobs: (...args: unknown[]) => insertJobsMock(...args),
  updateJobs: vi.fn(async () => 0),
}));

vi.mock("@/server/crawl/sources", () => ({
  boardKey: (entry: { name: string; provider: string }) => `${entry.provider}/${entry.name}`,
}));

const twoSources = [
  { name: "c0", provider: "greenhouse" },
  { name: "c1", provider: "greenhouse" },
];

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
    return Promise.resolve({ jobs: [], lastModified: null, complete: true });
  });
  getJobsByIdPrefixMock.mockResolvedValue([]);
  insertJobsMock.mockResolvedValue(0);
  deleteJobsByIdsMock.mockResolvedValue(0);
});

const registry = Array.from({ length: 19 }, (_, i) => ({
  name: `c${i}`,
  provider: "greenhouse",
}));

function sweep(ticks = TICKS_PER_SWEEP): string[] {
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
    for (let tick = 0; tick < TICKS_PER_SWEEP; tick += 1) {
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
    for (let tick = 0; tick < TICKS_PER_SWEEP; tick += 1) {
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
    expect(getJobsByIdPrefixMock).toHaveBeenCalledWith("gh-c0-");
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

  it("charges D1 writes to the budget so heavy boards stop later ones", async () => {
    fetchJobsMock.mockImplementation((_entry: unknown, budget?: { used: number }) => {
      if (budget) budget.used += 1;
      return Promise.resolve({ jobs: [makeJob("new")], lastModified: null, complete: true });
    });
    insertJobsMock.mockResolvedValue(15);
    const budget = createCrawlBudget();

    const run = await crawlAll(registry.slice(0, 4), budget);

    // Two boards run at once: 2 reads + 1 status + 1 fetch + 15 write batches each.
    expect(run.results).toHaveLength(2);
    expect(run.skipped).toBe(2);
    expect(budget.used).toBe(38);
  });

  it("propagates deletions when a board shrinks", async () => {
    const board = [makeJob("j1"), makeJob("j2"), makeJob("j3")];
    getJobsByIdPrefixMock.mockResolvedValue(board);
    fetchJobsMock.mockImplementation((_entry: unknown, budget?: { used: number }) => {
      if (budget) budget.used += 1;
      return Promise.resolve({ jobs: [makeJob("j2")], lastModified: null, complete: true });
    });

    const run = await crawlAll(registry.slice(0, 1), createCrawlBudget());

    expect(run.results[0]?.status).toBe("ok");
    expect(deleteJobsByIdsMock).toHaveBeenCalledWith(["j1", "j3"]);
  });

  it("never deletes jobs a partial fetch didn't reach", async () => {
    getJobsByIdPrefixMock.mockResolvedValue([makeJob("j1"), makeJob("j2")]);
    fetchJobsMock.mockImplementation((_entry: unknown, budget?: { used: number }) => {
      if (budget) budget.used += 1;
      return Promise.resolve({ jobs: [makeJob("j1")], lastModified: null, complete: false });
    });

    const run = await crawlAll(registry.slice(0, 1), createCrawlBudget());

    expect(run.results[0]?.status).toBe("ok");
    expect(deleteJobsByIdsMock).toHaveBeenCalledWith([]);
    expect(run.wrote).toBe(false);
  });

  it("guards against mass deletions on emptied boards", async () => {
    const board = Array.from({ length: 12 }, (_, i) => makeJob(`j${i}`));
    getJobsByIdPrefixMock.mockResolvedValue(board);
    fetchJobsMock.mockImplementation((_entry: unknown, budget?: { used: number }) => {
      if (budget) budget.used += 1;
      return Promise.resolve({ jobs: [makeJob("j0")], lastModified: null, complete: true });
    });

    const run = await crawlAll(registry.slice(0, 1), createCrawlBudget());

    expect(run.results[0]?.status).toBe("ok");
    expect(deleteJobsByIdsMock).toHaveBeenCalledWith([]);
    expect(run.wrote).toBe(false);
  });
});

describe("upcomingBoards", () => {
  it("covers the registry exactly once across a full sweep", () => {
    const names = upcomingBoards(twoSources, TICKS_PER_SWEEP, 0).map((entry) => entry.name);
    expect(names.sort()).toEqual(["c0", "c1"]);
  });

  it("skips the slice the cron already queued for the current tick", () => {
    expect(upcomingBoards(twoSources, 1, 0).map((entry) => entry.name)).toEqual(["c0"]);
  });
});
