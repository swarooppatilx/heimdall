import { cacheKv } from "@/lib/cache-kv";
import type { Job } from "@/lib/job";
import { formatError, logEvent } from "@/lib/logger";
import { MAX_LIMIT, type SearchResult } from "@/lib/types";
import { trackKvCache } from "@/modules/analytics/analytics";
import { searchJobs } from "@/server/jobs/search";

const ALL_JOBS_KEY = "all-jobs";
const EDGE_TTL_SECONDS = 300;
const KV_TTL_SECONDS = 2100;

export async function readAllJobsFromKV(
  env: Pick<CloudflareEnv, "CACHE">,
): Promise<Job[] | undefined> {
  const cache = cacheKv(env);
  if (!cache) return undefined;
  try {
    const jobs = await cache.get<Job[]>(ALL_JOBS_KEY, {
      type: "json",
      cacheTtl: EDGE_TTL_SECONDS,
    });
    trackKvCache({ operation: "read", key: ALL_JOBS_KEY, hit: Boolean(jobs) });
    return jobs ?? undefined;
  } catch (err) {
    logEvent("kv_read_failed", { key: ALL_JOBS_KEY, error: formatError(err) });
    trackKvCache({ operation: "read", key: ALL_JOBS_KEY, hit: false });
    return undefined;
  }
}

export async function writeAllJobsToKV(
  jobs: Job[],
  env: Pick<CloudflareEnv, "CACHE">,
): Promise<void> {
  const cache = cacheKv(env);
  if (!cache) return;
  try {
    await cache.put(ALL_JOBS_KEY, JSON.stringify(jobs), {
      expirationTtl: KV_TTL_SECONDS,
    });
    trackKvCache({ operation: "write", key: ALL_JOBS_KEY, hit: false });
  } catch (err) {
    logEvent("kv_write_failed", { key: ALL_JOBS_KEY, error: formatError(err) });
    trackKvCache({ operation: "write", key: ALL_JOBS_KEY, hit: false });
  }
}

export async function getCompanyJobsFromKV(
  env: Pick<CloudflareEnv, "CACHE">,
  company: string,
): Promise<SearchResult | undefined> {
  const allJobs = await readAllJobsFromKV(env);
  if (!allJobs) return undefined;
  return searchJobs(allJobs, { company }, { limit: MAX_LIMIT });
}

export async function getCompanyNamesFromKV(
  env: Pick<CloudflareEnv, "CACHE">,
): Promise<string[] | undefined> {
  const allJobs = await readAllJobsFromKV(env);
  if (!allJobs) return undefined;
  const names = [...new Set(allJobs.map((j) => j.company))].filter(Boolean).sort();
  return names;
}

export async function getRecentJobsFromKV(
  env: Pick<CloudflareEnv, "CACHE">,
  limit: number,
): Promise<Job[] | undefined> {
  const allJobs = await readAllJobsFromKV(env);
  if (!allJobs) return undefined;
  return [...allJobs].sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime()).slice(0, limit);
}
