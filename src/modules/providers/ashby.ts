import { inferDepartment } from "@/lib/department";
import { splitLocations } from "@/lib/gazetteer";
import { type CrawlBudget, fetchJson } from "@/lib/http";
import type { Job } from "@/lib/job";
import { normalizeLocation } from "@/lib/normalize";
import { mapPostings } from "@/lib/postings";

interface AshbyJob {
  id: string;
  title: string;
  department: string;
  location: string;
  publishedAt: string;
  jobUrl: string;
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
  };
}

export async function fetchAshbyJobs(company: string, budget?: CrawlBudget): Promise<Job[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${company}`;
  const data = await fetchJson<{ jobs: AshbyJob[] }>(url, company, undefined, undefined, budget);
  return mapPostings(data.jobs, company, (j) => mapJob(j, company));
}
