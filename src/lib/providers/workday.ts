import { inferDepartment } from "../department";
import { fetchJson } from "../http";
import type { Job } from "../job";
import { splitLocations } from "../locations";
import { normalizeLocation, regionFromLocation } from "../normalize";

interface WorkdayPosting {
  title: string;
  externalPath: string;
  locationsText?: string;
  postedOn?: string;
}

interface WorkdayResponse {
  total: number;
  jobPostings: WorkdayPosting[];
}

const PAGE_SIZE = 20;
const MAX_PAGES = 200;
const PAGE_CONCURRENCY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export function postedAtFrom(raw: string | undefined): Date {
  const text = (raw ?? "")
    .replace(/^posted\s+/i, "")
    .trim()
    .toLowerCase();
  if (text === "today") return new Date();
  if (text === "yesterday") return new Date(Date.now() - DAY_MS);
  const match = text.match(/^(\d+)\+?\s+days?\s+ago$/);
  if (match?.[1]) return new Date(Date.now() - Number(match[1]) * DAY_MS);
  return new Date(text);
}

function idFrom(path: string): string {
  const match = path.match(/(\d+)\/?$/);
  return match?.[1] ?? path;
}

function publicUrl(endpoint: string, path: string): string {
  const url = new URL(endpoint);
  const segments = url.pathname.split("/").filter(Boolean);
  const site = segments[segments.length - 2] ?? "";
  return `${url.origin}/en-US/${site}${path}`;
}

function mapJob(raw: WorkdayPosting, tenant: string, endpoint: string): Job {
  const location = raw.locationsText ?? "";
  return {
    id: `wd-${tenant}-${idFrom(raw.externalPath)}`,
    title: raw.title,
    company: tenant,
    location: normalizeLocation(location),
    locations: splitLocations(location).map((part) => normalizeLocation(part)),
    department: inferDepartment(raw.title),
    url: publicUrl(endpoint, raw.externalPath),
    postedAt: postedAtFrom(raw.postedOn),
    source: "workday",
    region: regionFromLocation(location),
  };
}

function fetchPage(endpoint: string, offset: number): Promise<WorkdayResponse> {
  return fetchJson<WorkdayResponse>(endpoint, endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ limit: PAGE_SIZE, offset, searchText: "" }),
  });
}

export async function fetchWorkdayJobs(apiUrl: string): Promise<Job[]> {
  if (!apiUrl) throw new Error("Missing workday api url");

  const url = new URL(apiUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  const tenant = segments[2] ?? apiUrl;

  const first = await fetchPage(apiUrl, 0);
  const maxOffset = Math.min(first.total, MAX_PAGES * PAGE_SIZE);

  const offsets: number[] = [];
  for (let offset = PAGE_SIZE; offset < maxOffset; offset += PAGE_SIZE) {
    offsets.push(offset);
  }

  const postings = [...first.jobPostings];
  for (let i = 0; i < offsets.length; i += PAGE_CONCURRENCY) {
    const chunk = offsets.slice(i, i + PAGE_CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map((offset) => fetchPage(apiUrl, offset)));
    for (const result of settled) {
      if (result.status === "fulfilled") postings.push(...result.value.jobPostings);
    }
  }

  return postings.map((p) => mapJob(p, tenant, apiUrl));
}
