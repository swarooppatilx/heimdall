import { z } from "zod";
import type { Job } from "@/lib/job";
import { type CrawlBudget, fetchJsonWithHeaders, hasBudgetLeft } from "@/server/crawl/http";
import { mapPostings, type ProviderResult } from "@/server/crawl/providers/postings";
import { postingLocations } from "@/server/locations/gazetteer";
import { logEvent } from "@/server/logger";

const smartRecruitersPostingSchema = z.object({
  id: z.string(),
  name: z.string(),
  uuid: z.string(),
  releasedDate: z.string(),
  company: z.object({ identifier: z.string() }),
  location: z
    .object({
      city: z.string().nullish(),
      region: z.string().nullish(),
      country: z.string().nullish(),
      fullLocation: z.string().nullish(),
      remote: z.boolean().nullish(),
    })
    .nullish(),
  department: z.union([
    z.object({ label: z.string().optional() }),
    z.record(z.string(), z.never()),
  ]),
  function: z.union([z.object({ label: z.string().optional() }), z.record(z.string(), z.never())]),
});

const smartRecruitersResponseSchema = z.object({
  totalFound: z.number(),
  content: z.array(z.unknown()),
});

function mapJob(raw: z.infer<typeof smartRecruitersPostingSchema>, company: string): Job {
  const locationStr = raw.location?.remote
    ? raw.location.fullLocation
      ? `Remote — ${raw.location.fullLocation}`
      : "Remote"
    : raw.location?.fullLocation || "Unknown";

  return {
    id: `sr-${company}-${raw.id}`,
    title: raw.name,
    company,
    ...postingLocations(locationStr),
    isRemote: Boolean(raw.location?.remote),
    department: ("label" in raw.department && raw.department.label) || "",
    departmentHints: "label" in raw.function && raw.function.label ? [raw.function.label] : [],
    url: `https://careers.smartrecruiters.com/${encodeURIComponent(company)}/${raw.uuid}`,
    postedAt: new Date(raw.releasedDate),
    source: "smartrecruiters",
  };
}

// 100 is the postings API's largest page. The page cap is a backstop against a
// runaway totalFound; in practice the crawl budget ends pagination first.
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export async function fetchSmartRecruitersJobs(
  company: string,
  budget?: CrawlBudget,
  ifModifiedSince?: string,
): Promise<ProviderResult | undefined> {
  const postings: unknown[] = [];
  let lastModified: string | null = null;
  let complete = false;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    // Out of budget: keep the pages fetched so far rather than failing the
    // whole board every sweep; the caller skips deletions for a partial board.
    if (budget && !hasBudgetLeft(budget)) {
      logEvent("crawl_partial", { company, pages: page, postings: postings.length });
      break;
    }
    const offset = page * PAGE_SIZE;
    const url = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings?limit=${PAGE_SIZE}&offset=${offset}`;
    const result = await fetchJsonWithHeaders(url, company, {
      schema: smartRecruitersResponseSchema,
      ...(budget ? { budget } : {}),
      ...(page === 0 && ifModifiedSince ? { ifModifiedSince } : {}),
    });
    if (result.data === undefined) return undefined;
    if (result.lastModified) lastModified = result.lastModified;
    const content = result.data.content ?? [];
    postings.push(...content);

    if (offset + PAGE_SIZE >= (result.data.totalFound ?? 0) || content.length === 0) {
      complete = true;
      break;
    }
  }

  const jobs = mapPostings(postings, company, smartRecruitersPostingSchema, (j) =>
    mapJob(j, company),
  );
  return { jobs, lastModified, complete };
}
