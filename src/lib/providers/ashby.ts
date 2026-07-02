import { inferDepartment } from "../department";
import type { Job } from "../job";
import { splitLocations } from "../locations";
import { normalizeLocation, regionFromLocation } from "../normalize";

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
    region: regionFromLocation(baseLocation),
    locations: splitLocations(baseLocation).map((part) => normalizeLocation(part)),
    department: (raw.department || inferDepartment(raw.title)).toLowerCase(),
    url: raw.jobUrl,
    postedAt: new Date(raw.publishedAt),
    source: "ashby",
    employmentType: (raw.employmentType ?? "").toLowerCase(),
  };
}

export async function fetchAshbyJobs(company: string): Promise<Job[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${company}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch jobs from ${company}: ${res.status}`);
  }

  const data = (await res.json()) as { jobs: AshbyJob[] };
  return data.jobs.map((j: AshbyJob) => mapJob(j, company));
}
