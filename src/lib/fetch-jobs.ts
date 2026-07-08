import { normalizeDepartment } from "./department";
import { detectExperienceLevel } from "./experience";
import { FRESHNESS_DAYS } from "./freshness";
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
  return {
    ...job,
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

  return jobs
    .filter((job) => {
      if (Number.isNaN(job.postedAt.getTime())) return false;
      const ageMs = Date.now() - job.postedAt.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      return ageDays <= FRESHNESS_DAYS;
    })
    .map(deriveFields);
}
