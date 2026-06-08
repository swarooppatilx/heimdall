import type { Job } from "../job";
import { normalizeLocation } from "../normalize";

interface GreenhouseJob {
  id: number;
  title: string;
  location: { name: string };
  updated_at: string;
  absolute_url: string;
  departments: { name: string }[];
}

function mapJob(raw: GreenhouseJob, board: string): Job {
  return {
    id: `gh-${board}-${raw.id}`,
    title: raw.title,
    company: board,
    location: normalizeLocation(raw.location.name),
    department: raw.departments?.[0]?.name ?? "General",
    url: raw.absolute_url,
    postedAt: new Date(raw.updated_at),
    source: "greenhouse",
  };
}

export async function fetchGreenhouseJobs(board: string): Promise<Job[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs`;
  const res = await fetch(url, { next: { revalidate: 3600 } });

  if (!res.ok) {
    throw new Error(`Failed to fetch jobs from ${board}: ${res.status}`);
  }

  const data = await res.json();
  return data.jobs.map((j: GreenhouseJob) => mapJob(j, board));
}
