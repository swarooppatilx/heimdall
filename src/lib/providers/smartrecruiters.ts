import type { Job } from "../job";
import { normalizeLocation } from "../normalize";

interface SmartRecruitersPosting {
  id: string;
  name: string;
  uuid: string;
  releasedDate: string;
  company: { identifier: string };
  location: {
    city: string;
    region: string;
    country: string;
    fullLocation: string;
    remote: boolean;
  };
  department: { label?: string } | Record<string, never>;
  function: { label?: string } | Record<string, never>;
}

interface SmartRecruitersResponse {
  totalFound: number;
  content: SmartRecruitersPosting[];
}

function mapJob(raw: SmartRecruitersPosting, company: string): Job {
  const locationStr = raw.location?.remote
    ? raw.location.fullLocation
      ? `Remote — ${raw.location.fullLocation}`
      : "Remote"
    : raw.location?.fullLocation || "Unknown";

  return {
    id: `sr-${company}-${raw.id}`,
    title: raw.name,
    company,
    location: normalizeLocation(locationStr),
    department:
      ("label" in raw.department && raw.department.label) ||
      ("label" in raw.function && raw.function.label) ||
      "General",
    url: `https://careers.smartrecruiters.com/${company}/${raw.uuid}`,
    postedAt: new Date(raw.releasedDate),
    source: "smartrecruiters",
  };
}

export async function fetchSmartRecruitersJobs(company: string): Promise<Job[]> {
  const allJobs: Job[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = `https://api.smartrecruiters.com/v1/companies/${company}/postings?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });

    if (!res.ok) {
      throw new Error(`Failed to fetch jobs from ${company}: ${res.status}`);
    }

    const data: SmartRecruitersResponse = await res.json();
    allJobs.push(...data.content.map((j) => mapJob(j, company)));

    if (offset + limit >= data.totalFound || data.content.length === 0) break;
    offset += limit;
  }

  return allJobs;
}
