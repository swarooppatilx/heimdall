import { z } from "zod";
import { type CrawlBudget, fetchJson } from "@/lib/http";
import { normalizeLocation, normalizeLocations } from "@/modules/crawl/normalize";
import { inferDepartment } from "@/modules/jobs/department";
import type { Job } from "@/modules/jobs/job";
import { mapPostings } from "@/modules/providers/postings";

const workableJobSchema = z.object({
  title: z.string(),
  shortcode: z.string(),
  telecommuting: z.boolean().optional(),
  department: z.string().optional(),
  url: z.string().optional(),
  shortlink: z.string().optional(),
  published_on: z.string().optional(),
  created_at: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  locations: z
    .array(z.object({ city: z.string().optional(), country: z.string().optional() }))
    .optional(),
});

const workableResponseSchema = z.object({
  jobs: z.array(workableJobSchema).optional(),
});

function widgetUrl(account: string): string {
  return `https://apply.workable.com/api/v1/widget/accounts/${account}`;
}

function primaryLocation(raw: z.infer<typeof workableJobSchema>): string {
  const place = [raw.city, raw.country].filter(Boolean).join(", ");
  if (raw.telecommuting) return place ? `Remote — ${place}` : "Remote";
  return place;
}

function structuredLocations(raw: z.infer<typeof workableJobSchema>): string[] {
  const listed = (raw.locations ?? [])
    .map((loc) => [loc.city, loc.country].filter(Boolean).join(", "))
    .filter(Boolean);
  const primary = normalizeLocations(primaryLocation(raw));
  return [...listed.map((entry) => normalizeLocation(entry)), ...primary];
}

function mapJob(raw: z.infer<typeof workableJobSchema>, account: string): Job {
  const dateStr = raw.published_on ?? raw.created_at;
  if (!dateStr) throw new Error(`Workable job ${raw.shortcode} missing posting date`);
  return {
    id: `wb-${account}-${raw.shortcode}`,
    title: raw.title,
    company: account,
    location: normalizeLocation(primaryLocation(raw)),
    locations: structuredLocations(raw),
    department: (raw.department || inferDepartment(raw.title)).toLowerCase(),
    url: raw.url ?? raw.shortlink ?? "",
    postedAt: new Date(dateStr),
    source: "workable",
  };
}

export async function fetchWorkableJobs(account: string, budget?: CrawlBudget): Promise<Job[]> {
  const board = await fetchJson(widgetUrl(account), account, {
    schema: workableResponseSchema,
    ...(budget ? { budget } : {}),
  });
  return mapPostings(board.jobs, account, (posting) => mapJob(posting, account));
}
