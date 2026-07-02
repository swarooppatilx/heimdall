import { inferDepartment } from "../department";
import type { Job } from "../job";
import { splitLocations } from "../locations";
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
  typeOfEmployment?: { label?: string };
  experienceLevel?: { label?: string };
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
    locations: splitLocations(locationStr).map((part) => normalizeLocation(part)),
    department: (
      ("label" in raw.department && raw.department.label) ||
      ("label" in raw.function && raw.function.label) ||
      inferDepartment(raw.name)
    ).toLowerCase(),
    url: `https://careers.smartrecruiters.com/${company}/${raw.uuid}`,
    postedAt: new Date(raw.releasedDate),
    source: "smartrecruiters",
    employmentType: (raw.typeOfEmployment?.label ?? "").toLowerCase(),
    region: (raw.location?.country ?? "").toLowerCase(),
    isEarlyCareer: /intern|graduate|entry|junior/i.test(
      `${raw.experienceLevel?.label ?? ""} ${raw.name}`,
    ),
  };
}

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export async function fetchSmartRecruitersJobs(company: string): Promise<Job[]> {
  const allJobs: Job[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    const url = `https://api.smartrecruiters.com/v1/companies/${company}/postings?limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch jobs from ${company}: ${res.status}`);
    }

    const data: SmartRecruitersResponse = await res.json();
    allJobs.push(...data.content.map((j) => mapJob(j, company)));

    if (offset + PAGE_SIZE >= data.totalFound || data.content.length === 0) break;
  }

  return allJobs;
}
