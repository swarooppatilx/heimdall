import { deleteJobsByIds, getJobsByIds, insertJobs, recordCrawl, updateJobs } from "./db";
import { diffJobs } from "./diff";
import { fetchJobs } from "./fetch-jobs";
import { getRegistry, type RegistryEntry } from "./registry";

export interface CrawlResult {
  company: string;
  status: "ok" | "error";
  jobsFound: number;
  durationMs: number;
  error?: string;
}

const TICK_MS = 15 * 60 * 1000;
const TICKS_PER_SWEEP = 8;

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
}

export async function crawlAll(slice?: RegistryEntry[]): Promise<CrawlRun> {
  const start = Date.now();
  const registry = slice ?? getRegistry();
  const results: CrawlResult[] = [];

  const settled = await Promise.allSettled(registry.map((entry) => crawlOne(entry)));

  for (let i = 0; i < registry.length; i++) {
    const entry = registry[i];
    const result = settled[i];
    if (!entry || !result) continue;

    if (result.status === "fulfilled") {
      results.push(result.value);
    } else {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      results.push({
        company: entry.name,
        status: "error",
        jobsFound: 0,
        durationMs: 0,
        error: msg,
      });
    }
  }

  const discovered = results
    .filter((r) => r.status === "ok")
    .reduce((sum, r) => sum + r.jobsFound, 0);

  return { results, discovered, durationMs: Date.now() - start };
}

async function crawlOne(entry: RegistryEntry): Promise<CrawlResult> {
  const start = Date.now();
  try {
    const jobs = await fetchJobs(entry);
    if (jobs.length === 0) {
      const durationMs = Date.now() - start;
      await recordCrawl(entry.name, "ok", 0, durationMs);
      return { company: entry.name, status: "ok", jobsFound: 0, durationMs };
    }
    const existing = await getJobsByIds(jobs.map((job) => job.id));
    const diff = diffJobs(existing, jobs);
    await insertJobs(diff.inserts);
    await updateJobs(diff.updates);
    await deleteJobsByIds(diff.deletedIds);
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
