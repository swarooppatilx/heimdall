import type { Job } from "@/lib/job";
import { isHttpUrl } from "@/lib/url";
import type { CrawlBudget } from "@/server/crawl/http";
import { fetchAshbyJobs } from "@/server/crawl/providers/ashby";
import { fetchGreenhouseJobs } from "@/server/crawl/providers/greenhouse";
import { fetchLeverJobs } from "@/server/crawl/providers/lever";
import type { ProviderResult } from "@/server/crawl/providers/postings";
import { fetchSmartRecruitersJobs } from "@/server/crawl/providers/smartrecruiters";
import { fetchWorkableJobs } from "@/server/crawl/providers/workable";
import type { Source } from "@/server/crawl/sources";
import { inferDepartment } from "@/server/jobs/department";
import { mapDepartment } from "@/server/jobs/department-map";
import { freshnessCutoff } from "@/server/jobs/freshness";
import { detectLevel } from "@/server/jobs/level";
import { sanitizeFilterValue } from "@/server/jobs/sanitize";
import { formatPlace, resolvePlace } from "@/server/locations/gazetteer";
import { logEvent } from "@/server/logger";

type ProviderFetcher = (
  board: string,
  budget?: CrawlBudget,
  ifModifiedSince?: string,
) => Promise<ProviderResult | undefined>;

interface Provider {
  idPrefix: string;
  fetch: ProviderFetcher;
}

const PROVIDERS: Record<string, Provider> = {
  greenhouse: { idPrefix: "gh", fetch: fetchGreenhouseJobs },
  lever: { idPrefix: "lv", fetch: fetchLeverJobs },
  ashby: { idPrefix: "ab", fetch: fetchAshbyJobs },
  smartrecruiters: { idPrefix: "sr", fetch: fetchSmartRecruitersJobs },
  workable: { idPrefix: "wb", fetch: fetchWorkableJobs },
};

function providerFor(entry: Source): Provider {
  const provider = PROVIDERS[entry.provider];
  if (!provider) throw new Error(`Unknown provider: ${entry.provider}`);
  return provider;
}

/** Every job id from a board starts with this prefix, e.g. `gh-doordash-`. */
export function boardIdPrefix(entry: Source): string {
  return `${providerFor(entry).idPrefix}-${entry.name}-`;
}

// One line per board fetch, capped, so the mapping table grows from real
// values without flooding the logs.
const UNMAPPED_SAMPLE = 10;

function logUnmapped(company: string, departments: Set<string>): void {
  if (departments.size === 0) return;
  logEvent("taxonomy_unmapped", {
    company,
    departments: [...departments].slice(0, UNMAPPED_SAMPLE),
  });
}

// ATS taxonomy first (department, then team/function), the title only when
// the ATS says nothing we recognise.
function classifyDepartment(job: Job, unmapped: Set<string>): string {
  const match = mapDepartment([job.department, ...(job.departmentHints ?? [])]);
  for (const value of match.unmapped) unmapped.add(value);
  return match.department ?? inferDepartment(job.title);
}

function deriveFields(posting: Job, unmapped: Set<string>): Job {
  // Hints are read here and never stored.
  const department = classifyDepartment(posting, unmapped);
  const { departmentHints: _departmentHints, ...job } = posting;
  const place = resolvePlace(job.location);
  // A remote role keeps its country ("remote, germany") so country filters
  // still find it; it just has no city.
  const city = place?.remote ? undefined : place?.city;
  const country = place?.country;
  const rawLocations = [job.location, ...(job.locations ?? [])];
  // A provider's own remote flag wins; otherwise any remote office counts.
  const isRemote =
    Boolean(job.isRemote) || rawLocations.some((entry) => resolvePlace(entry)?.remote);
  return {
    ...job,
    company: sanitizeFilterValue(job.company),
    location: place ? formatPlace(place) : "unknown",
    ...(city === undefined ? {} : { city }),
    ...(country === undefined ? {} : { country }),
    isRemote,
    level: detectLevel(job.title),
    department,
  };
}

export async function fetchJobs(
  entry: Source,
  budget?: CrawlBudget,
  ifModifiedSince?: string,
): Promise<ProviderResult | undefined> {
  const result = await providerFor(entry).fetch(entry.name, budget, ifModifiedSince);
  if (result === undefined) return undefined;

  const company = entry.label ?? entry.name;

  const unsafeUrls = result.jobs.filter((job) => !isHttpUrl(job.url)).length;
  if (unsafeUrls > 0) logEvent("postings_invalid_url", { company, skipped: unsafeUrls });

  const cutoffMs = Date.parse(freshnessCutoff());
  const unmapped = new Set<string>();

  const jobs = result.jobs
    .filter((job) => isHttpUrl(job.url))
    .filter((job) => {
      if (Number.isNaN(job.postedAt.getTime())) return false;
      return job.postedAt.getTime() >= cutoffMs;
    })
    .map((job) => deriveFields({ ...job, company }, unmapped));
  logUnmapped(company, unmapped);

  return { jobs, lastModified: result.lastModified, complete: result.complete };
}
