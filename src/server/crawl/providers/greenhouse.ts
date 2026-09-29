import { z } from "zod";
import type { Job } from "@/lib/job";
import { type CrawlBudget, fetchJsonWithHeaders } from "@/server/crawl/http";
import { mapPostings, type ProviderResult } from "@/server/crawl/providers/postings";
import { postingLocations } from "@/server/locations/gazetteer";

const greenhouseJobSchema = z.object({
  id: z.number(),
  title: z.string(),
  location: z.object({ name: z.string() }),
  updated_at: z.string(),
  first_published: z.string().nullish(),
  absolute_url: z.string(),
  metadata: z
    .array(z.object({ name: z.string(), value: z.unknown(), value_type: z.string().nullish() }))
    .nullish(),
});

const currencyRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  currency: z.string().nullish(),
});

const greenhouseResponseSchema = z.object({
  jobs: z.array(z.unknown()),
});

const WHOLE_NUMBERS: Intl.NumberFormatOptions = { maximumFractionDigits: 0 };

// "$120,000 – $160,000" with a real currency symbol. A missing or unknown
// currency code (Intl throws RangeError) falls back to bare numbers rather
// than the old " 70,000 – 90,000" with a dangling space.
export function formatSalaryRange(min: number, max: number, currency?: string | null): string {
  if (currency) {
    try {
      return new Intl.NumberFormat("en", {
        ...WHOLE_NUMBERS,
        style: "currency",
        currency,
      }).formatRange(min, max);
    } catch {
      // fall through to plain numbers
    }
  }
  const plain = new Intl.NumberFormat("en", WHOLE_NUMBERS);
  return `${plain.format(min)} – ${plain.format(max)}`;
}

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
    (m) => keyPattern.test(m.name) && (!typePattern || typePattern.test(m.value_type ?? "")),
  );
  if (entry?.value == null || entry.value === "") return { value: "", salary: "" };

  if (entry.value_type === "currency_range") {
    const range = currencyRangeSchema.safeParse(entry.value);
    if (!range.success) return { value: "", salary: "" };
    const salary = formatSalaryRange(range.data.min, range.data.max, range.data.currency);
    return { value: salary, salary };
  }

  return { value: String(entry.value), salary: "" };
}

export async function fetchGreenhouseJobs(
  board: string,
  budget?: CrawlBudget,
  ifModifiedSince?: string,
): Promise<ProviderResult | undefined> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs`;
  const result = await fetchJsonWithHeaders(url, board, {
    schema: greenhouseResponseSchema,
    ...(budget ? { budget } : {}),
    ...(ifModifiedSince ? { ifModifiedSince } : {}),
  });
  if (result.data === undefined) return undefined;
  const jobs = mapPostings(result.data.jobs, board, greenhouseJobSchema, (j) => mapJob(j, board));
  return { jobs, lastModified: result.lastModified, complete: true };
}

function mapJob(raw: z.infer<typeof greenhouseJobSchema>, board: string): Job {
  // Boards name their department custom field differently ("Department",
  // "External Department", "Team"); the field name is matched, not the value.
  const department = metaValue(raw, /department|categor|^area\b|team/i).value;
  const pay = metaValue(raw, /pay|salary|compensation/i, /currency|range/);

  return {
    id: `gh-${board}-${raw.id}`,
    title: raw.title,
    company: board,
    ...postingLocations(raw.location.name),
    department,
    url: raw.absolute_url,
    postedAt: new Date(raw.first_published ?? raw.updated_at),
    source: "greenhouse",
    salary: pay.salary,
  };
}
