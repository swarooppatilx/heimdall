import { deleteJobsByIds, getJobsByIds, insertJobs, recordCrawl, updateJobs } from "./db";
import { diffJobs, isSuspiciousDeletion } from "./diff";
import { fetchJobs } from "./fetch-jobs";
import { type CrawlBudget, createCrawlBudget } from "./http";
import { logEvent } from "./logger";
import { getRegistry, type RegistryEntry } from "./registry";

export interface CrawlResult {
  company: string;
  status: "ok" | "error";
  jobsFound: number;
  durationMs: number;
  error?: string;
}

const MS_PER_MINUTE = 60_000;

const TICK_MINUTES = 15;
const TICK_MS = TICK_MINUTES * MS_PER_MINUTE;
const TICK_MARGIN_MINUTES = 2;
const TICK_MARGIN_MS = TICK_MARGIN_MINUTES * MS_PER_MINUTE;
const TICKS_PER_SWEEP = 8;
const CRAWL_CONCURRENCY = 20;
const EXTERNAL_SUBREQUEST_LIMIT = 50;
const SUBREQUEST_HEADROOM = 10;

function hasBudgetLeft(budget: CrawlBudget): boolean {
  return budget.used < EXTERNAL_SUBREQUEST_LIMIT - SUBREQUEST_HEADROOM;
}

export function shouldRunTick(lastCrawlUnix: number | null, now: number): boolean {
  if (lastCrawlUnix === null) return true;
  return now - lastCrawlUnix >= TICK_MS - TICK_MARGIN_MS;
}

export function sweepOrdinal(now = Date.now()): number {
  return Math.floor(now / TICK_MS) % TICKS_PER_SWEEP;
}

export function sweepSlice(entries: RegistryEntry[], now = Date.now()): RegistryEntry[] {
  const ordinal = sweepOrdinal(now);
  const start = Math.floor((ordinal * entries.length) / TICKS_PER_SWEEP);
  const end = Math.floor(((ordinal + 1) * entries.length) / TICKS_PER_SWEEP);
  return entries.slice(start, end);
}

export interface CrawlRun {
  results: CrawlResult[];
  discovered: number;
  durationMs: number;
  skipped: number;
}

export async function crawlAll(
  slice?: RegistryEntry[],
  budget: CrawlBudget = createCrawlBudget(),
): Promise<CrawlRun> {
  const start = Date.now();
  const registry = slice ?? getRegistry();
  const results: CrawlResult[] = [];

  let cursor = 0;
  const workers = Array.from({ length: Math.min(CRAWL_CONCURRENCY, registry.length) }, async () => {
    while (cursor < registry.length && hasBudgetLeft(budget)) {
      const entry = registry[cursor];
      cursor += 1;
      if (entry) results.push(await crawlOne(entry, budget));
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
  };
}

async function crawlOne(entry: RegistryEntry, budget?: CrawlBudget): Promise<CrawlResult> {
  const start = Date.now();
  try {
    const jobs = await fetchJobs(entry, budget);
    if (jobs.length === 0) {
      const durationMs = Date.now() - start;
      await recordCrawl(entry.name, "ok", 0, durationMs);
      return { company: entry.name, status: "ok", jobsFound: 0, durationMs };
    }
    const existing = await getJobsByIds(jobs.map((job) => job.id));
    const diff = diffJobs(existing, jobs);
    await insertJobs(diff.inserts);
    await updateJobs(diff.updates);
    if (isSuspiciousDeletion(existing.length, diff.deletedIds.length)) {
      logEvent("suspicious_diff", {
        company: entry.name,
        existing: existing.length,
        deleted: diff.deletedIds.length,
      });
    } else {
      await deleteJobsByIds(diff.deletedIds);
    }
    const durationMs = Date.now() - start;
    await recordCrawl(entry.name, "ok", jobs.length, durationMs);
    return {
      company: entry.name,
      status: "ok",
      jobsFound: jobs.length,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    await recordCrawl(entry.name, "error", 0, durationMs, msg);
    return {
      company: entry.name,
      status: "error",
      jobsFound: 0,
      durationMs,
      error: msg,
    };
  }
}
