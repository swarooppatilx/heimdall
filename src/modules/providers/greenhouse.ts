import { z } from "zod";
import { type CrawlBudget, fetchJson } from "@/lib/http";
import { splitLocations } from "@/modules/crawl/gazetteer";
import { normalizeLocation, normalizeLocations } from "@/modules/crawl/normalize";
import { inferDepartment } from "@/modules/jobs/department";
import type { Job } from "@/modules/jobs/job";
import { mapPostings } from "@/modules/providers/postings";

const greenhouseJobSchema = z.object({
  id: z.number(),
  title: z.string(),
  location: z.object({ name: z.string() }),
  updated_at: z.string(),
  first_published: z.string().optional(),
  absolute_url: z.string(),
  metadata: z
    .array(z.object({ name: z.string(), value: z.unknown(), value_type: z.string() }))
    .optional(),
});

const greenhouseResponseSchema = z.object({
  jobs: z.array(greenhouseJobSchema),
});

interface MetaMatch {
  value: string;
  salary: string;
}

function metaValue(
  job: z.infer<typeof greenhouseJobSchema>,
  keyPattern: RegExp,
  typePattern?: RegExp,
): MetaMatch {
  const entry = job.metadata?.find(
    (m) => keyPattern.test(m.name) && (!typePattern || typePattern.test(m.value_type)),
  );
  if (entry?.value == null || entry.value === "") return { value: "", salary: "" };

  if (
    entry.value_type === "currency_range" &&
    typeof entry.value === "object" &&
    entry.value != null
  ) {
    const range = entry.value as { min?: number; max?: number; currency?: string };
    const currency = range.currency ?? "";
    const unit = currency === "USD" ? "$" : `${currency} `;
    const salary =
      range.min != null && range.max != null
        ? `${unit}${range.min.toLocaleString()} – ${unit}${range.max.toLocaleString()}`
        : "";
    return { value: salary, salary };
  }

  return { value: String(entry.value), salary: "" };
}

export async function fetchGreenhouseJobs(board: string, budget?: CrawlBudget): Promise<Job[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs`;
  const data = await fetchJson(url, board, {
    schema: greenhouseResponseSchema,
    ...(budget ? { budget } : {}),
  });
  return mapPostings(data.jobs, board, (j) => mapJob(j, board));
}

function mapJob(raw: z.infer<typeof greenhouseJobSchema>, board: string): Job {
  const locationParts = splitLocations(raw.location.name);
  const primary = normalizeLocation(locationParts[0] ?? "");
  const department = (
    metaValue(raw, /department|categor|^area\b|team/i).value || inferDepartment(raw.title)
  ).toLowerCase();
  const pay = metaValue(raw, /pay|salary|compensation/i, /currency|range/);
  const region = metaValue(raw, /geography|region|country/i).value.toLowerCase();
  const earlyCareerMeta = raw.metadata?.some(
    (m) => /early career/i.test(m.name) && Boolean(m.value),
  );

  return {
    id: `gh-${board}-${raw.id}`,
    title: raw.title,
    company: board,
    location: primary,
    locations: normalizeLocations(raw.location.name),
    department,
    url: raw.absolute_url,
    postedAt: new Date(raw.first_published ?? raw.updated_at),
    source: "greenhouse",
    salary: pay.salary,
    region,
    isEarlyCareer: Boolean(earlyCareerMeta),
  };
}
