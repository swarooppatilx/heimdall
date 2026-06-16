import { deleteStaleJobs, recordCrawl, upsertJobs } from "./db";
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

export function sweepSlice(entries: RegistryEntry[], now = Date.now()): RegistryEntry[] {
  const sliceSize = Math.ceil(entries.length / TICKS_PER_SWEEP);
  const ordinal = Math.floor(now / TICK_MS) % TICKS_PER_SWEEP;
  const start = Math.min(ordinal * sliceSize, entries.length - sliceSize);
  return entries.slice(start, start + sliceSize);
}

export async function crawlAll(slice?: RegistryEntry[]): Promise<CrawlResult[]> {
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

  await deleteStaleJobs();

  return results;
}

async function crawlOne(entry: RegistryEntry): Promise<CrawlResult> {
  const start = Date.now();
  try {
    const jobs = await fetchJobs(entry);
    await upsertJobs(jobs);
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
