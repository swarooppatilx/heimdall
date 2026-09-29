import { z } from "zod";
import type { Job } from "@/lib/job";
import { type CrawlBudget, fetchJsonWithHeaders } from "@/server/crawl/http";
import { mapPostings, type ProviderResult } from "@/server/crawl/providers/postings";
import { postingLocations } from "@/server/locations/gazetteer";

const ashbyJobSchema = z.object({
  id: z.string(),
  title: z.string(),
  department: z.string().nullish(),
  team: z.string().nullish(),
  location: z.string(),
  publishedAt: z.string(),
  jobUrl: z.string(),
  isRemote: z.boolean().nullish(),
});

const ashbyResponseSchema = z.object({
  jobs: z.array(z.unknown()),
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
    ...postingLocations(baseLocation),
    isRemote: Boolean(raw.isRemote),
    department: raw.department ?? "",
    departmentHints: raw.team ? [raw.team] : [],
    url: raw.jobUrl,
    postedAt: new Date(raw.publishedAt),
    source: "ashby",
  };
}

export async function fetchAshbyJobs(
  company: string,
  budget?: CrawlBudget,
  ifModifiedSince?: string,
): Promise<ProviderResult | undefined> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(company)}`;
  const result = await fetchJsonWithHeaders(url, company, {
    schema: ashbyResponseSchema,
    ...(budget ? { budget } : {}),
    ...(ifModifiedSince ? { ifModifiedSince } : {}),
  });
  if (result.data === undefined) return undefined;
  const jobs = mapPostings(result.data.jobs, company, ashbyJobSchema, (j) => mapJob(j, company));
  return { jobs, lastModified: result.lastModified, complete: true };
}
