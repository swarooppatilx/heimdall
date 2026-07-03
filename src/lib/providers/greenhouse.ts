import { inferDepartment } from "../department";
import { fetchJson } from "../http";
import type { Job } from "../job";
import { splitLocations } from "../locations";
import { normalizeLocation } from "../normalize";

interface GreenhouseJob {
  id: number;
  title: string;
  location: { name: string };
  updated_at: string;
  first_published?: string;
  absolute_url: string;
  metadata?: { name: string; value: unknown; value_type: string }[];
}

interface MetaMatch {
  value: string;
  salary: string;
}

function metaValue(job: GreenhouseJob, keyPattern: RegExp, typePattern?: RegExp): MetaMatch {
  const entry = job.metadata?.find(
    (m) => keyPattern.test(m.name) && (!typePattern || typePattern.test(m.value_type)),
  );
  if (entry?.value == null || entry.value === "") return { value: "", salary: "" };

  if (entry.value_type === "currency_range" && typeof entry.value === "object") {
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

export async function fetchGreenhouseJobs(board: string): Promise<Job[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs`;
  const data = await fetchJson<{ jobs: GreenhouseJob[] }>(url, board);
  return data.jobs.map((j: GreenhouseJob) => mapJob(j, board));
}

export function mapJob(raw: GreenhouseJob, board: string): Job {
  const locationParts = splitLocations(raw.location.name);
  const primary = normalizeLocation(locationParts[0] ?? "");
  const department = (
    metaValue(raw, /department|categor|^area\b|team/i).value || inferDepartment(raw.title)
  ).toLowerCase();
  const employmentType = metaValue(raw, /^(time|employment) ?type$/i).value.toLowerCase();
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
    locations: locationParts.map((part) => normalizeLocation(part)),
    department,
    url: raw.absolute_url,
    postedAt: new Date(raw.first_published ?? raw.updated_at),
    source: "greenhouse",
    employmentType,
    salary: pay.salary,
    region,
    isEarlyCareer: earlyCareerMeta,
  };
}
