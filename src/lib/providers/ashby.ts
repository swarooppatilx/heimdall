import type { Job } from "../job";

interface AshbyJob {
  id: string;
  title: string;
  department: string;
  location: string;
  publishedAt: string;
  jobUrl: string;
}

function mapJob(raw: AshbyJob, company: string): Job {
  return {
    id: `ab-${company}-${raw.id}`,
    title: raw.title,
    company,
    location: raw.location,
    department: raw.department ?? "General",
    url: raw.jobUrl,
    postedAt: new Date(raw.publishedAt),
    source: "ashby",
  };
}

export async function fetchAshbyJobs(company: string): Promise<Job[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${company}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });

  if (!res.ok) {
    throw new Error(`Failed to fetch jobs from ${company}: ${res.status}`);
  }

  const data = await res.json();
  return data.jobs.map((j: AshbyJob) => mapJob(j, company));
}
