import { inferDepartment } from "../department";
import { fetchJson } from "../http";
import type { Job } from "../job";
import { splitLocations } from "../locations";
import { normalizeLocation, regionFromLocation } from "../normalize";

interface LeverPosting {
  id: string;
  text: string;
  categories: {
    department: string;
    location: string;
  };
  createdAt: number;
  hostedUrl: string;
}

function mapJob(raw: LeverPosting, company: string): Job {
  return {
    id: `lv-${company}-${raw.id}`,
    title: raw.text,
    company,
    location: normalizeLocation(raw.categories.location ?? ""),
    locations: splitLocations(raw.categories.location ?? "").map((part) => normalizeLocation(part)),
    region: regionFromLocation(raw.categories.location ?? ""),
    department: (raw.categories.department || inferDepartment(raw.text)).toLowerCase(),
    url: raw.hostedUrl,
    postedAt: new Date(raw.createdAt),
    source: "lever",
  };
}

export async function fetchLeverJobs(company: string): Promise<Job[]> {
  const url = `https://api.lever.co/v0/postings/${company}`;
  const data = await fetchJson<LeverPosting[]>(url, company);
  return data.map((p: LeverPosting) => mapJob(p, company));
}
