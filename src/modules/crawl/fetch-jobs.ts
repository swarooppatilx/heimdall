import { normalizeDepartment } from "@/lib/department";
import { detectExperienceLevel } from "@/lib/experience";
import { freshnessCutoff } from "@/lib/freshness";
import { formatPlace, resolvePlace } from "@/lib/gazetteer";
import type { CrawlBudget } from "@/lib/http";
import type { Job } from "@/lib/job";
import { logEvent } from "@/lib/logger";
import { fetchAshbyJobs } from "@/lib/providers/ashby";
import { fetchGreenhouseJobs } from "@/lib/providers/greenhouse";
import { fetchLeverJobs } from "@/lib/providers/lever";
import { fetchSmartRecruitersJobs } from "@/lib/providers/smartrecruiters";
import { fetchWorkableJobs } from "@/lib/providers/workable";
import type { RegistryEntry } from "@/lib/registry";
import { sanitizeFilterValue } from "@/lib/sanitize";

type ProviderFetcher = (entry: RegistryEntry, budget?: CrawlBudget) => Promise<Job[]>;

const PROVIDERS: Record<string, ProviderFetcher> = {
  greenhouse: (entry, budget) => fetchGreenhouseJobs(entry.name, budget),
  lever: (entry, budget) => fetchLeverJobs(entry.name, budget),
  ashby: (entry, budget) => fetchAshbyJobs(entry.name, budget),
  smartrecruiters: (entry, budget) => fetchSmartRecruitersJobs(entry.name, budget),
  workable: (entry, budget) => fetchWorkableJobs(entry.name, budget),
};

function deriveFields(job: Job): Job {
  const level = job.experienceLevel ?? detectExperienceLevel(job.title);
  const place = resolvePlace(job.location);
  const city = place?.remote ? undefined : place?.city;
  const country = place?.remote ? undefined : place?.country;
  const rawLocations = [job.location, ...(job.locations ?? [])];
  const isRemote = rawLocations.some((entry) => resolvePlace(entry)?.remote);
  return {
    ...job,
    company: sanitizeFilterValue(job.company),
    location: place ? formatPlace(place) : "unknown",
    region: country ?? "",
    ...(city === undefined ? {} : { city }),
    ...(country === undefined ? {} : { country }),
    isRemote,
    experienceLevel: level,
    isEarlyCareer: Boolean(job.isEarlyCareer) || level === "intern" || level === "entry",
    department: normalizeDepartment(job.department),
  };
}

const ALLOWED_URL_PROTOCOLS = new Set(["http:", "https:"]);

function hasSafeUrl(url: string): boolean {
  try {
    return ALLOWED_URL_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

export async function fetchJobs(entry: RegistryEntry, budget?: CrawlBudget): Promise<Job[]> {
  const fetchProviderJobs = PROVIDERS[entry.provider];

  if (!fetchProviderJobs) {
    throw new Error(`Unknown provider: ${entry.provider}`);
  }

  const mapped = await fetchProviderJobs(entry, budget);
  const company = entry.label ?? entry.name;

  const unsafeUrls = mapped.filter((job) => !hasSafeUrl(job.url)).length;
  if (unsafeUrls > 0) logEvent("postings_invalid_url", { company, skipped: unsafeUrls });

  const cutoffMs = Date.parse(freshnessCutoff());

  return mapped
    .filter((job) => hasSafeUrl(job.url))
    .filter((job) => {
      if (Number.isNaN(job.postedAt.getTime())) return false;
      return job.postedAt.getTime() >= cutoffMs;
    })
    .map((job) => deriveFields({ ...job, company }));
}
