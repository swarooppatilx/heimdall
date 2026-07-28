import { beforeEach, describe, expect, it, vi } from "vitest";
import { crawlAll, shouldRunTick, sweepSlice } from "./crawler";
import { createCrawlBudget } from "./http";

vi.mock("./fetch-jobs", () => ({
  fetchJobs: vi.fn((_entry: unknown, budget?: { used: number }) => {
    if (budget) budget.used += 1;
    return Promise.resolve([]);
  }),
}));

vi.mock("./db", () => ({
  deleteJobsByIds: vi.fn(async () => {}),
  getJobsByIds: vi.fn(async () => []),
  insertJobs: vi.fn(async () => {}),
  recordCrawl: vi.fn(async () => {}),
  updateJobs: vi.fn(async () => {}),
}));

beforeEach(() => {
  vi.clearAllMocks();
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
});
