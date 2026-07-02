import { inferDepartment } from "../department";
import type { Job } from "../job";
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
    region: regionFromLocation(raw.categories.location ?? ""),
    department: (raw.categories.department || inferDepartment(raw.text)).toLowerCase(),
    url: raw.hostedUrl,
    postedAt: new Date(raw.createdAt),
    source: "lever",
  };
}

export async function fetchLeverJobs(company: string): Promise<Job[]> {
  const url = `https://api.lever.co/v0/postings/${company}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch jobs from ${company}: ${res.status}`);
  }

  const data = (await res.json()) as LeverPosting[];
  return data.map((p: LeverPosting) => mapJob(p, company));
}
