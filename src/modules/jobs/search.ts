import { resolvePlace } from "@/lib/gazetteer";
import type { Job } from "@/lib/job";
import { sanitizeFilterValue } from "@/lib/sanitize";
import {
  DEFAULT_LIMIT,
  type JobFilters,
  MAX_LIMIT,
  type PageOptions,
  POSTED_WINDOWS_MS,
  type SearchResult,
} from "@/modules/jobs/types";

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
      (a, b) => a.company.localeCompare(b.company) || b.postedAt.getTime() - a.postedAt.getTime(),
    );
  }
  return [...jobs].sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
}

export function searchJobs(allJobs: Job[], filters: JobFilters, page?: PageOptions): SearchResult {
  const limit = Math.min(Math.max(page?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(page?.offset ?? 0, 0);

  const filtered = allJobs.filter((job) => matchesFilters(job, filters));
  const sorted = sortJobs(filtered, filters.sort);

  return {
    jobs: sorted.slice(offset, offset + limit),
    total: filtered.length,
  };
}
