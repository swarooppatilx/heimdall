import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { JobSearch } from "@/components/jobs/job-search";
import type { HomeInitialData } from "@/hooks/use-job-search";
import { toJobDto } from "@/lib/job";
import { DEFAULT_LIMIT, parseHomeFilters, toJobFilters } from "@/lib/search-params";
import { getFacetOptionsCached } from "@/server/jobs/cached-views";
import { searchJobsWithCount } from "@/server/jobs/queries";
import { formatError, logError } from "@/server/logger";

export const metadata: Metadata = {
  // Next merges metadata shallowly: a layout-level `alternates` would be
  // replaced by this one, so the feed link lives here with the canonical.
  alternates: { canonical: "/", types: { "application/rss+xml": "/feed.xml" } },
};

type SearchParams = Record<string, string | string[] | undefined>;

function toUrlSearchParams(params: SearchParams): URLSearchParams {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) result.set(key, first);
  }
  return result;
}

async function loadInitialData(params: SearchParams): Promise<HomeInitialData> {
  const filters = parseHomeFilters(toUrlSearchParams(params));
  try {
    const { env } = await getCloudflareContext({ async: true });
    const [result, facets] = await Promise.all([
      searchJobsWithCount(toJobFilters(filters), { limit: DEFAULT_LIMIT }),
      getFacetOptionsCached(env),
    ]);
    return {
      filters,
      page: { jobs: result.jobs.map(toJobDto), total: result.total },
      facets,
    };
  } catch (err) {
    logError("home_ssr_failed", { error: formatError(err) });
    return { filters };
  }
}

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <JobSearch initial={await loadInitialData(await searchParams)} />;
}
