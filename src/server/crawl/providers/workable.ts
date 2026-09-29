import { z } from "zod";
import type { Job } from "@/lib/job";
import { type CrawlBudget, fetchJsonWithHeaders } from "@/server/crawl/http";
import { mapPostings, type ProviderResult } from "@/server/crawl/providers/postings";
import { splitLocations } from "@/server/locations/gazetteer";

const workableJobSchema = z.object({
  title: z.string(),
  shortcode: z.string(),
  telecommuting: z.boolean().nullish(),
  department: z.string().nullish(),
  url: z.string().nullish(),
  shortlink: z.string().nullish(),
  published_on: z.string().nullish(),
  created_at: z.string().nullish(),
  country: z.string().nullish(),
  city: z.string().nullish(),
  locations: z
    .array(z.object({ city: z.string().nullish(), country: z.string().nullish() }))
    .nullish(),
});

const workableResponseSchema = z.object({
  jobs: z.array(z.unknown()).nullish(),
});

function widgetUrl(account: string): string {
  return `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(account)}`;
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
  return [...listed, ...splitLocations(primaryLocation(raw))];
}

function mapJob(raw: z.infer<typeof workableJobSchema>, account: string): Job {
  const dateStr = raw.published_on ?? raw.created_at;
  if (!dateStr) throw new Error(`Workable job ${raw.shortcode} missing posting date`);
  return {
    id: `wb-${account}-${raw.shortcode}`,
    title: raw.title,
    company: account,
    location: primaryLocation(raw),
    locations: structuredLocations(raw),
    isRemote: Boolean(raw.telecommuting),
    department: raw.department ?? "",
    url: raw.url ?? raw.shortlink ?? "",
    postedAt: new Date(dateStr),
    source: "workable",
  };
}

export async function fetchWorkableJobs(
  account: string,
  budget?: CrawlBudget,
  ifModifiedSince?: string,
): Promise<ProviderResult | undefined> {
  const board = await fetchJsonWithHeaders(widgetUrl(account), account, {
    schema: workableResponseSchema,
    ...(budget ? { budget } : {}),
    ...(ifModifiedSince ? { ifModifiedSince } : {}),
  });
  if (board.data === undefined) return undefined;
  const jobs = mapPostings(board.data.jobs, account, workableJobSchema, (posting) =>
    mapJob(posting, account),
  );
  return { jobs, lastModified: board.lastModified, complete: true };
}
