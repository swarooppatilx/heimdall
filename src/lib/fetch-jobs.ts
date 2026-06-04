import type { Job } from "./job";
import type { RegistryEntry } from "./registry";
import { fetchGreenhouseJobs } from "./providers/greenhouse";

const MAX_AGE_DAYS = 15;

export async function fetchJobs(entry: RegistryEntry): Promise<Job[]> {
  let jobs: Job[];

  if (entry.provider === "greenhouse") {
    jobs = await fetchGreenhouseJobs(entry.board);
  } else {
    throw new Error(`Unknown provider: ${entry.provider}`);
  }

  return jobs.filter((job) => {
    const ageMs = Date.now() - job.postedAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays <= MAX_AGE_DAYS;
  });
}
