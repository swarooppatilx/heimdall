import { z } from "zod";
import { type CrawlBudget, fetchJson } from "@/lib/http";
import { normalizeLocation, normalizeLocations } from "@/modules/crawl/normalize";
import { inferDepartment } from "@/modules/jobs/department";
import type { Job } from "@/modules/jobs/job";
import { mapPostings } from "@/modules/providers/postings";

const ashbyJobSchema = z.object({
  id: z.string(),
  title: z.string(),
  department: z.string(),
  location: z.string(),
  publishedAt: z.string(),
  jobUrl: z.string(),
  isRemote: z.boolean().optional(),
});

const ashbyResponseSchema = z.object({
  jobs: z.array(ashbyJobSchema),
});

function mapJob(raw: z.infer<typeof ashbyJobSchema>, company: string): Job {
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
    locations: normalizeLocations(baseLocation),
    department: (raw.department || inferDepartment(raw.title)).toLowerCase(),
    url: raw.jobUrl,
    postedAt: new Date(raw.publishedAt),
    source: "ashby",
  };
}

export async function fetchAshbyJobs(company: string, budget?: CrawlBudget): Promise<Job[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${company}`;
  const data = await fetchJson(url, company, {
    schema: ashbyResponseSchema,
    ...(budget ? { budget } : {}),
  });
  return mapPostings(data.jobs, company, (j) => mapJob(j, company));
}
