import { z } from "zod";
import { type CrawlBudget, fetchJson } from "@/lib/http";
import { normalizeLocation, normalizeLocations } from "@/modules/crawl/normalize";
import { inferDepartment } from "@/modules/jobs/department";
import type { Job } from "@/modules/jobs/job";
import { mapPostings } from "@/modules/providers/postings";

const leverPostingSchema = z.object({
  id: z.string(),
  text: z.string(),
  categories: z.object({
    department: z.string(),
    location: z.string(),
  }),
  createdAt: z.number(),
  hostedUrl: z.string(),
});

const leverResponseSchema = z.array(leverPostingSchema);

function mapJob(raw: z.infer<typeof leverPostingSchema>, company: string): Job {
  return {
    id: `lv-${company}-${raw.id}`,
    title: raw.text,
    company,
    location: normalizeLocation(raw.categories.location ?? ""),
    locations: normalizeLocations(raw.categories.location ?? ""),
    department: (raw.categories.department || inferDepartment(raw.text)).toLowerCase(),
    url: raw.hostedUrl,
    postedAt: new Date(raw.createdAt),
    source: "lever",
  };
}

export async function fetchLeverJobs(company: string, budget?: CrawlBudget): Promise<Job[]> {
  const url = `https://api.lever.co/v0/postings/${company}`;
  const data = await fetchJson(url, company, {
    schema: leverResponseSchema,
    ...(budget ? { budget } : {}),
  });
  return mapPostings(data, company, (p) => mapJob(p, company));
}
