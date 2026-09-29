import { cache } from "cloudflare:workers";
import { JOBS_CACHE_TAG } from "@/server/api/cache-headers";
import { formatError, logError, logEvent } from "@/server/logger";

/** Drops every edge-cached response built from job data. Never throws. */
export async function purgeJobsCache(): Promise<void> {
  try {
    const result = await cache.purge({ tags: [JOBS_CACHE_TAG] });
    if (result.success) logEvent("edge_cache_purged", { tag: JOBS_CACHE_TAG });
    else logError("edge_cache_purge_failed", { tag: JOBS_CACHE_TAG, errors: result.errors });
  } catch (err) {
    logError("edge_cache_purge_failed", { tag: JOBS_CACHE_TAG, error: formatError(err) });
  }
}
