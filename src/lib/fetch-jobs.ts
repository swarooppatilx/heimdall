import { detectExperienceLevel } from "./experience";
import { FRESHNESS_DAYS } from "./freshness";
import type { Job } from "./job";
import { fetchAshbyJobs } from "./providers/ashby";
import { fetchGreenhouseJobs } from "./providers/greenhouse";
import { fetchLeverJobs } from "./providers/lever";
import { fetchSmartRecruitersJobs } from "./providers/smartrecruiters";
import type { RegistryEntry } from "./registry";

export type ProviderFetcher = (board: string) => Promise<Job[]>;

const PROVIDERS: Record<string, ProviderFetcher> = {
  greenhouse: fetchGreenhouseJobs,
  lever: fetchLeverJobs,
  ashby: fetchAshbyJobs,
  smartrecruiters: fetchSmartRecruitersJobs,
};

function withSeniority(job: Job): Job {
  const level = job.experienceLevel ?? detectExperienceLevel(job.title);
  return {
    ...job,
    experienceLevel: level,
    isEarlyCareer: Boolean(job.isEarlyCareer) || level === "intern" || level === "entry",
  };
}

export async function fetchJobs(entry: RegistryEntry): Promise<Job[]> {
  const fetchProviderJobs = PROVIDERS[entry.provider];

  if (!fetchProviderJobs) {
    throw new Error(`Unknown provider: ${entry.provider}`);
  }

  const jobs = await fetchProviderJobs(entry.board);

  return jobs
    .filter((job) => {
      if (Number.isNaN(job.postedAt.getTime())) return false;
      const ageMs = Date.now() - job.postedAt.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      return ageDays <= FRESHNESS_DAYS;
    })
    .map(withSeniority);
}
