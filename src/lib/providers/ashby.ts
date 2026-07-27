import { inferDepartment } from "../department";
import { type CrawlBudget, fetchJson } from "../http";
import type { Job } from "../job";
import { splitLocations } from "../locations";
import { normalizeLocation } from "../normalize";

interface AshbyJob {
  id: string;
  title: string;
  department: string;
  location: string;
  publishedAt: string;
  jobUrl: string;
  employmentType?: string;
  isRemote?: boolean;
}

function mapJob(raw: AshbyJob, company: string): Job {
  const baseLocation = raw.isRemote
    ? raw.location.toLowerCase().startsWith("remote")
      ? raw.location
      : `Remote — ${raw.location}`
    : raw.location;

  return {
    id: `ab-${company}-${raw.id}`,
    title: raw.title,
    company,
    location: normalizeLocation(baseLocation),
    locations: splitLocations(baseLocation).map((part) => normalizeLocation(part)),
    department: (raw.department || inferDepartment(raw.title)).toLowerCase(),
    url: raw.jobUrl,
    postedAt: new Date(raw.publishedAt),
    source: "ashby",
    employmentType: (raw.employmentType ?? "").toLowerCase(),
  };
}

export async function fetchAshbyJobs(company: string, budget?: CrawlBudget): Promise<Job[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${company}`;
  const data = await fetchJson<{ jobs: AshbyJob[] }>(url, company, undefined, undefined, budget);
  return data.jobs.map((j: AshbyJob) => mapJob(j, company));
}
