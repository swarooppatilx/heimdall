import { z } from "zod";
import type { Job } from "@/lib/job";
import { type CrawlBudget, fetchJsonWithHeaders } from "@/server/crawl/http";
import { mapPostings, type ProviderResult } from "@/server/crawl/providers/postings";
import { postingLocations } from "@/server/locations/gazetteer";

const leverPostingSchema = z.object({
  id: z.string(),
  text: z.string(),
  categories: z.object({
    department: z.string().nullish(),
    team: z.string().nullish(),
    location: z.string().nullish(),
  }),
  createdAt: z.number(),
  hostedUrl: z.string(),
});

const leverResponseSchema = z.array(z.unknown());

function mapJob(raw: z.infer<typeof leverPostingSchema>, company: string): Job {
  return {
    id: `lv-${company}-${raw.id}`,
    title: raw.text,
    company,
    ...postingLocations(raw.categories.location ?? ""),
    department: raw.categories.department ?? "",
    departmentHints: raw.categories.team ? [raw.categories.team] : [],
    url: raw.hostedUrl,
    postedAt: new Date(raw.createdAt),
    source: "lever",
  };
}

export async function fetchLeverJobs(
  company: string,
  budget?: CrawlBudget,
  ifModifiedSince?: string,
): Promise<ProviderResult | undefined> {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(company)}`;
  const result = await fetchJsonWithHeaders(url, company, {
    schema: leverResponseSchema,
    ...(budget ? { budget } : {}),
    ...(ifModifiedSince ? { ifModifiedSince } : {}),
  });
  if (result.data === undefined) return undefined;
  const jobs = mapPostings(result.data, company, leverPostingSchema, (p) => mapJob(p, company));
  return { jobs, lastModified: result.lastModified, complete: true };
}
