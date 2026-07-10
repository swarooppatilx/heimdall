import { normalizeDepartment } from "./department";
import { resolveEmploymentType } from "./employment";
import { detectExperienceLevel } from "./experience";
import { FRESHNESS_DAYS } from "./freshness";
import { formatPlace, resolvePlace } from "./gazetteer";
import type { Job } from "./job";
import { fetchAshbyJobs } from "./providers/ashby";
import { fetchGreenhouseJobs } from "./providers/greenhouse";
import { fetchLeverJobs } from "./providers/lever";
import { fetchSmartRecruitersJobs } from "./providers/smartrecruiters";
import { fetchWorkdayJobs } from "./providers/workday";
import type { RegistryEntry } from "./registry";

export type ProviderFetcher = (entry: RegistryEntry) => Promise<Job[]>;

const PROVIDERS: Record<string, ProviderFetcher> = {
  greenhouse: (entry) => fetchGreenhouseJobs(entry.name),
  lever: (entry) => fetchLeverJobs(entry.name),
  ashby: (entry) => fetchAshbyJobs(entry.name),
  smartrecruiters: (entry) => fetchSmartRecruitersJobs(entry.name),
  workday: (entry) => fetchWorkdayJobs(entry.apiUrl ?? ""),
};

function deriveFields(job: Job): Job {
  const level = job.experienceLevel ?? detectExperienceLevel(job.title);
  const place = resolvePlace(job.location);
  const city = place?.remote ? undefined : place?.city;
  const country = place?.remote ? undefined : place?.country;
  return {
    ...job,
    location: place ? formatPlace(place) : "unknown",
    region: country?.toLowerCase() ?? "",
    city,
    country,
    employmentType: resolveEmploymentType(job.employmentType),
    experienceLevel: level,
    isEarlyCareer: Boolean(job.isEarlyCareer) || level === "intern" || level === "entry",
    department: normalizeDepartment(job.department),
  };
}

export async function fetchJobs(entry: RegistryEntry): Promise<Job[]> {
  const fetchProviderJobs = PROVIDERS[entry.provider];

  if (!fetchProviderJobs) {
    throw new Error(`Unknown provider: ${entry.provider}`);
  }

  const jobs = await fetchProviderJobs(entry);
  const company = entry.label ?? entry.name;

  return jobs
    .filter((job) => {
      if (Number.isNaN(job.postedAt.getTime())) return false;
      const ageMs = Date.now() - job.postedAt.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      return ageDays <= FRESHNESS_DAYS;
    })
    .map((job) => deriveFields({ ...job, company }));
}
