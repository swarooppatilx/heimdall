import { formatError, logEvent } from "@/lib/logger";
import { warmFacetCache } from "@/modules/jobs/facet-cache";
import { writeAllJobsToKV } from "@/modules/jobs/kv";
import { getAllFreshJobs } from "@/modules/jobs/queries";

export async function warmAllCaches(env: Pick<CloudflareEnv, "CACHE">): Promise<number> {
  const allJobs = await getAllFreshJobs();
  try {
    await writeAllJobsToKV(allJobs, env);
    await warmFacetCache(env);
  } catch (err) {
    logEvent("kv_warm_failed", { error: formatError(err) });
  }
  return allJobs.length;
}
