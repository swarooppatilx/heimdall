import { inferDepartment } from "@/lib/department";
import { splitLocations } from "@/lib/gazetteer";
import { type CrawlBudget, fetchJson } from "@/lib/http";
import type { Job } from "@/lib/job";
import { normalizeLocation } from "@/lib/normalize";
import { mapPostings } from "@/lib/postings";

interface WorkableJob {
  title: string;
  shortcode: string;
  telecommuting?: boolean;
  department?: string;
  url?: string;
  shortlink?: string;
  published_on?: string;
  created_at?: string;
  country?: string;
  city?: string;
  locations?: { city?: string; country?: string }[];
}

interface WorkableBoard {
  jobs?: WorkableJob[];
}

function widgetUrl(account: string): string {
  return `https://apply.workable.com/api/v1/widget/accounts/${account}`;
}

function primaryLocation(raw: WorkableJob): string {
  const place = [raw.city, raw.country].filter(Boolean).join(", ");
  if (raw.telecommuting) return place ? `Remote — ${place}` : "Remote";
  return place;
}

function structuredLocations(raw: WorkableJob): string[] {
  const listed = (raw.locations ?? [])
    .map((loc) => [loc.city, loc.country].filter(Boolean).join(", "))
    .filter(Boolean);
  const primary = splitLocations(primaryLocation(raw)).map((part) => normalizeLocation(part));
  return [...listed.map((entry) => normalizeLocation(entry)), ...primary];
}

function mapJob(raw: WorkableJob, account: string): Job {
  return {
    id: `wb-${account}-${raw.shortcode}`,
    title: raw.title,
    company: account,
    location: normalizeLocation(primaryLocation(raw)),
    locations: structuredLocations(raw),
    department: (raw.department || inferDepartment(raw.title)).toLowerCase(),
    url: raw.url ?? raw.shortlink ?? "",
    postedAt: new Date(raw.published_on ?? raw.created_at ?? ""),
    source: "workable",
  };
}

export async function fetchWorkableJobs(account: string, budget?: CrawlBudget): Promise<Job[]> {
  const board = await fetchJson<WorkableBoard>(
    widgetUrl(account),
    account,
    undefined,
    undefined,
    budget,
  );
  return mapPostings(board.jobs, account, (posting) => mapJob(posting, account));
}
