import { z } from "zod";
import type { Job } from "@/lib/job";
import { type CrawlBudget, fetchJson } from "@/server/crawl/http";
import { normalizeLocation, normalizeLocations } from "@/server/crawl/normalize";
import { mapPostings } from "@/server/crawl/providers/postings";
import { inferDepartment } from "@/server/jobs/department";

const smartRecruitersPostingSchema = z.object({
  id: z.string(),
  name: z.string(),
  uuid: z.string(),
  releasedDate: z.string(),
  company: z.object({ identifier: z.string() }),
  location: z.object({
    city: z.string(),
    region: z.string(),
    country: z.string(),
    fullLocation: z.string(),
    remote: z.boolean(),
  }),
  department: z.union([
    z.object({ label: z.string().optional() }),
    z.record(z.string(), z.never()),
  ]),
  function: z.union([z.object({ label: z.string().optional() }), z.record(z.string(), z.never())]),
  experienceLevel: z.object({ label: z.string().optional() }).optional(),
});

const smartRecruitersResponseSchema = z.object({
  totalFound: z.number(),
  content: z.array(smartRecruitersPostingSchema),
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
    location: normalizeLocation(locationStr),
    locations: normalizeLocations(locationStr),
    department: (
      ("label" in raw.department && raw.department.label) ||
      ("label" in raw.function && raw.function.label) ||
      inferDepartment(raw.name)
    ).toLowerCase(),
    url: `https://careers.smartrecruiters.com/${company}/${raw.uuid}`,
    postedAt: new Date(raw.releasedDate),
    source: "smartrecruiters",
    region: (raw.location?.country ?? "").toLowerCase(),
    isEarlyCareer: /intern|graduate|entry|junior/i.test(
      `${raw.experienceLevel?.label ?? ""} ${raw.name}`,
    ),
  };
}

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export async function fetchSmartRecruitersJobs(
  company: string,
  budget?: CrawlBudget,
): Promise<Job[]> {
  const postings: z.infer<typeof smartRecruitersPostingSchema>[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const offset = page * PAGE_SIZE;
    const url = `https://api.smartrecruiters.com/v1/companies/${company}/postings?limit=${PAGE_SIZE}&offset=${offset}`;
    const data = await fetchJson(url, company, {
      schema: smartRecruitersResponseSchema,
      ...(budget ? { budget } : {}),
    });
    const content = data.content ?? [];
    postings.push(...content);

    if (offset + PAGE_SIZE >= (data.totalFound ?? 0) || content.length === 0) break;
  }

  return mapPostings(postings, company, (j) => mapJob(j, company));
}
