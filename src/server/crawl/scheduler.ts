import { MS_PER_MINUTE } from "@/lib/time";
import { type BoardCrawlResult, crawlBoard } from "@/server/crawl/board";
import { type CrawlBudget, createCrawlBudget, hasBudgetLeft } from "@/server/crawl/http";
import type { Source } from "@/server/crawl/sources";

const TICK_MINUTES = 30;
export const TICK_MS = TICK_MINUTES * MS_PER_MINUTE;
// Each tick enqueues a quarter of the registry, so a full sweep takes two hours.
export const TICKS_PER_SWEEP = 4;
// The budget is checked before each board starts, so every board in flight can
// still spend its writes. Two at a time keeps that overshoot small inside the
// 50 subrequests (fetches and D1 calls) one queue invocation is allowed.
const CRAWL_CONCURRENCY = 2;

export function sweepOrdinal(now = Date.now()): number {
  return Math.floor(now / TICK_MS) % TICKS_PER_SWEEP;
}

export function sweepSlice(entries: Source[], now = Date.now()): Source[] {
  const ordinal = sweepOrdinal(now);
  const start = Math.floor((ordinal * entries.length) / TICKS_PER_SWEEP);
  const end = Math.floor(((ordinal + 1) * entries.length) / TICKS_PER_SWEEP);
  return entries.slice(start, end);
}

export interface CrawlRun {
  results: BoardCrawlResult[];
  discovered: number;
  durationMs: number;
  skipped: number;
  wrote: boolean;
}

export async function crawlAll(
  registry: Source[],
  budget: CrawlBudget = createCrawlBudget(),
): Promise<CrawlRun> {
  const start = Date.now();
  const results: BoardCrawlResult[] = [];
  let anyWrote = false;

  let cursor = 0;
  const workers = Array.from({ length: Math.min(CRAWL_CONCURRENCY, registry.length) }, async () => {
    while (cursor < registry.length && hasBudgetLeft(budget)) {
      const entry = registry[cursor];
      cursor += 1;
      if (entry) {
        const result = await crawlBoard(entry, budget);
        if (result.wrote) anyWrote = true;
        results.push(result);
      }
    }
  });
  await Promise.all(workers);

  const discovered = results
    .filter((r) => r.status === "ok")
    .reduce((sum, r) => sum + r.jobsFound, 0);

  return {
    results,
    discovered,
    durationMs: Date.now() - start,
    skipped: registry.length - results.length,
    wrote: anyWrote,
  };
}

// Starts at the next tick: the current slice is already queued by the cron.
export function upcomingBoards(sources: Source[], count: number, now = Date.now()): Source[] {
  return Array.from({ length: count }, (_, i) =>
    sweepSlice(sources, now + (i + 1) * TICK_MS),
  ).flat();
}
