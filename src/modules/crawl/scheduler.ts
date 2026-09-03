import { type CrawlBudget, createCrawlBudget, hasBudgetLeft } from "@/lib/http";
import { formatError, logEvent } from "@/lib/logger";
import { MS_PER_MINUTE } from "@/lib/time";
import { fetchJobs } from "@/modules/crawl/fetch-jobs";
import { getRegistry, type RegistryEntry } from "@/modules/crawl/registry";
import { recordCrawl } from "@/modules/crawl/store";
import { diffJobs, isSuspiciousDeletion } from "@/modules/jobs/diff";
import type { Job } from "@/modules/jobs/job";
import { getJobsByBoard } from "@/modules/jobs/queries";
import { deleteJobsByIds, insertJobs, updateJobs } from "@/modules/jobs/writes";

interface CrawlResult {
  company: string;
  status: "ok" | "error";
  jobsFound: number;
  durationMs: number;
  error?: string;
}

const TICK_MINUTES = 30;
const TICK_MS = TICK_MINUTES * MS_PER_MINUTE;
const TICK_MARGIN_MINUTES = 2;
const TICK_MARGIN_MS = TICK_MARGIN_MINUTES * MS_PER_MINUTE;
const TICKS_PER_SWEEP = 16;
const CRAWL_CONCURRENCY = 6;

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

interface CrawlRun {
  results: CrawlResult[];
  discovered: number;
  durationMs: number;
  skipped: number;
}

async function applyDiff(
  entry: RegistryEntry,
  existing: Job[],
  fetched: Job[],
): Promise<{ inserts: number; updates: number; deleted: number }> {
  const diff = diffJobs(existing, fetched);
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
  return {
    inserts: diff.inserts.length,
    updates: diff.updates.length,
    deleted: diff.deletedIds.length,
  };
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

export async function crawlSlices(count: number): Promise<CrawlRun[]> {
  const registry = getRegistry();
  const now = Date.now();
  const runs: CrawlRun[] = [];
  for (let i = 0; i < count; i += 1) {
    runs.push(await crawlAll(sweepSlice(registry, now + i * TICK_MS)));
  }
  return runs;
}

function recordSafe(
  entry: RegistryEntry,
  status: "ok" | "error",
  jobsFound: number,
  durationMs: number,
  error?: string,
): Promise<void> {
  return recordCrawl(entry.name, status, jobsFound, durationMs, error).catch((err: unknown) => {
    logEvent("crawl_record_failed", { company: entry.name, error: formatError(err) });
  });
}

async function crawlOne(entry: RegistryEntry, budget?: CrawlBudget): Promise<CrawlResult> {
  const start = Date.now();
  try {
    const jobs = await fetchJobs(entry, budget);
    const existing = await getJobsByBoard(entry.provider, entry.name);
    await applyDiff(entry, existing, jobs);
    const durationMs = Date.now() - start;
    await recordSafe(entry, "ok", jobs.length, durationMs);
    return {
      company: entry.name,
      status: "ok",
      jobsFound: jobs.length,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const msg = formatError(err);
    await recordSafe(entry, "error", 0, durationMs, msg);
    return {
      company: entry.name,
      status: "error",
      jobsFound: 0,
      durationMs,
      error: msg,
    };
  }
}
