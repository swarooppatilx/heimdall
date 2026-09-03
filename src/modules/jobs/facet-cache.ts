import { cacheKv } from "@/lib/cache-kv";
import { formatError, logEvent } from "@/lib/logger";
import { trackKvCache } from "@/modules/analytics/analytics";
import { type FacetOptions, getFacetOptions } from "@/modules/jobs/facets";

const CACHE_KEY = "facet-options";
const EDGE_TTL_SECONDS = 300;
const KV_TTL_SECONDS = 3600;

export async function getFacetOptionsCached(
  env: Pick<CloudflareEnv, "CACHE">,
): Promise<FacetOptions> {
  const cache = cacheKv(env);
  if (cache) {
    try {
      const hit = await cache.get<FacetOptions>(CACHE_KEY, {
        type: "json",
        cacheTtl: EDGE_TTL_SECONDS,
      });
      if (hit) {
        trackKvCache({ operation: "read", key: CACHE_KEY, hit: true });
        return hit;
      }
    } catch (err) {
      logEvent("kv_read_failed", { key: CACHE_KEY, error: formatError(err) });
    }
  }

  trackKvCache({ operation: "read", key: CACHE_KEY, hit: false });
  const options = await getFacetOptions();

  if (cache) {
    try {
      await cache.put(CACHE_KEY, JSON.stringify(options), {
        expirationTtl: KV_TTL_SECONDS,
      });
    } catch (err) {
      logEvent("kv_write_failed", { key: CACHE_KEY, error: formatError(err) });
    }
  }
  return options;
}

export async function warmFacetCache(env: Pick<CloudflareEnv, "CACHE">): Promise<void> {
  const cache = cacheKv(env);
  if (!cache) return;
  try {
    const options = await getFacetOptions();
    await cache.put(CACHE_KEY, JSON.stringify(options), {
      expirationTtl: KV_TTL_SECONDS,
    });
  } catch (err) {
    logEvent("kv_warm_failed", { key: CACHE_KEY, error: formatError(err) });
  }
}
