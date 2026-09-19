import { cacheKv } from "@/lib/cache-kv";
import { formatError, logEvent } from "@/lib/logger";
import { warmFacetCache } from "@/server/jobs/facet-cache";
import { writeAllJobsToKV } from "@/server/jobs/kv";
import { getAllFreshJobs } from "@/server/jobs/queries";

const ALL_JOBS_KEY = "all-jobs";

export async function warmAllCaches(env: Pick<CloudflareEnv, "CACHE">): Promise<number> {
  const cache = cacheKv(env);
  if (cache) {
    try {
      const existing = await cache.get(ALL_JOBS_KEY, { type: "json" });
      if (existing) {
        logEvent("kv_warm_skipped", { key: ALL_JOBS_KEY, reason: "already_cached" });
        await warmFacetCache(env);
        return (existing as unknown[]).length;
      }
    } catch (err) {
      logEvent("kv_read_failed", { key: ALL_JOBS_KEY, error: formatError(err) });
    }
  }

  const allJobs = await getAllFreshJobs();
  try {
    await writeAllJobsToKV(allJobs, env);
    await warmFacetCache(env);
  } catch (err) {
    logEvent("kv_warm_failed", { error: formatError(err) });
  }
  return allJobs.length;
}
