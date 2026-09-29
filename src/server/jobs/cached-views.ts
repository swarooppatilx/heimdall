import type { FacetOptions } from "@/lib/api-types";
import type { Job } from "@/lib/job";
import { type CacheOptions, cached, refreshCache } from "@/server/cache";
import { getFacetOptions } from "@/server/jobs/facets";
import { type CompanyEntry, getCompanyIndex, getRecentJobs } from "@/server/jobs/queries";

// KV reads are cached at the edge for this long, so a view can lag the cron's
// rewrite by up to five minutes; the views only change when a crawl lands.
const EDGE_TTL_SECONDS = 300;

// Bounds llms-full.txt and the RSS feed, which list recent jobs on one page.
export const RECENT_JOBS_LIMIT = 200;

export type JobLink = Pick<Job, "title" | "company" | "url" | "location"> & { postedAt: string };

type Env = Pick<CloudflareEnv, "CACHE">;

async function loadRecentJobLinks(): Promise<JobLink[]> {
  const jobs = await getRecentJobs(RECENT_JOBS_LIMIT);
  return jobs.map(({ title, company, url, location, postedAt }) => ({
    title,
    company,
    url,
    location,
    postedAt: postedAt.toISOString(),
  }));
}

function view<T>(env: Env, key: string, loader: () => Promise<T>): CacheOptions<T> {
  return { env, key, edgeTtlSeconds: EDGE_TTL_SECONDS, loader };
}

// Keys are renamed when a view's shape changes: cron-owned keys never expire,
// so an old value under the same key would be served until the next crawl.
const facets = (env: Env) => view(env, "facet-options:v2", getFacetOptions);
const companyIndex = (env: Env) => view(env, "company-index", getCompanyIndex);
const recentJobLinks = (env: Env) => view(env, "recent-jobs:v2", loadRecentJobLinks);

export function getFacetOptionsCached(env: Env): Promise<FacetOptions> {
  return cached(facets(env));
}

export function getCompanyIndexCached(env: Env): Promise<CompanyEntry[]> {
  return cached(companyIndex(env));
}

export function getRecentJobLinksCached(env: Env): Promise<JobLink[]> {
  return cached(recentJobLinks(env));
}

export async function warmJobViews(env: Env): Promise<void> {
  await Promise.all([
    refreshCache(facets(env)),
    refreshCache(companyIndex(env)),
    refreshCache(recentJobLinks(env)),
  ]);
}
