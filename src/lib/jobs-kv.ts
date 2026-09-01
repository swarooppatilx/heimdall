import { trackKvCache } from "@/lib/analytics";
import { cacheKv } from "@/lib/cache-kv";
import { resolvePlace } from "@/lib/gazetteer";
import type { Job } from "@/lib/job";
import { logEvent } from "@/lib/logger";
import { sanitizeFilterValue } from "@/lib/sanitize";

const ALL_JOBS_KEY = "all-jobs";
const EDGE_TTL_SECONDS = 300;
const KV_TTL_SECONDS = 2100;
const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

const POSTED_WINDOWS_MS: Record<string, number> = {
  today: MS_PER_DAY,
  week: DAYS_PER_WEEK * MS_PER_DAY,
};

export interface JobFilters {
  q?: string;
  company?: string;
  location?: string;
  city?: string;
  country?: string;
  source?: string;
  experience?: string;
  posted?: string;
  department?: string;
  earlyCareer?: string;
  sort?: string;
}

export interface PageOptions {
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  jobs: Job[];
  total: number;
}

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
  } catch {
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
    logEvent("kv_write_failed", { error: String(err) });
  }
}

function matchesQuery(job: Job, query: string): boolean {
  const lower = query.toLowerCase();
  return (
    job.title.toLowerCase().includes(lower) ||
    job.company.toLowerCase().includes(lower) ||
    job.location.toLowerCase().includes(lower) ||
    job.department.toLowerCase().includes(lower)
  );
}

function matchesLocation(job: Job, location: string): boolean {
  const place = resolvePlace(location);
  if (place?.remote) return Boolean(job.isRemote);
  if (place?.city) return job.city === place.city;
  if (place?.country) return job.country === place.country;
  return job.location.toLowerCase().includes(location.toLowerCase());
}

function matchesPosted(postedAt: Date, posted: string): boolean {
  const windowMs = POSTED_WINDOWS_MS[posted];
  if (!windowMs) return true;
  const cutoff = new Date(Date.now() - windowMs);
  return postedAt.getTime() >= cutoff.getTime();
}

function matchesFilters(job: Job, filters: JobFilters): boolean {
  if (filters.q && !matchesQuery(job, filters.q)) return false;
  if (filters.company && job.company !== sanitizeFilterValue(filters.company)) return false;
  if (filters.location && !matchesLocation(job, filters.location)) return false;
  if (filters.city && job.city !== filters.city.toLowerCase()) return false;
  if (filters.country && job.country !== filters.country.toLowerCase()) return false;
  if (filters.source && job.source !== filters.source.toLowerCase()) return false;
  if (filters.experience && job.experienceLevel !== sanitizeFilterValue(filters.experience))
    return false;
  if (filters.department && job.department !== sanitizeFilterValue(filters.department))
    return false;
  if (filters.earlyCareer === "true" && !job.isEarlyCareer) return false;
  if (filters.posted && !matchesPosted(job.postedAt, filters.posted)) return false;
  return true;
}

function sortJobs(jobs: Job[], sort: string | undefined): Job[] {
  if (sort === "company") {
    return [...jobs].sort(
      (a, b) =>
        a.company.localeCompare(b.company) ||
        new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
    );
  }
  return [...jobs].sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
}

export function searchJobsFromKV(
  allJobs: Job[],
  filters: JobFilters,
  page?: PageOptions,
): SearchResult {
  const limit = Math.min(Math.max(page?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(page?.offset ?? 0, 0);

  const filtered = allJobs.filter((job) => matchesFilters(job, filters));
  const sorted = sortJobs(filtered, filters.sort);

  return {
    jobs: sorted.slice(offset, offset + limit),
    total: filtered.length,
  };
}
