import { cacheKv } from "@/lib/cache-kv";
import { type FacetOptions, getFacetOptions } from "@/lib/facets";

const CACHE_KEY = "facet-options";
const EDGE_TTL_SECONDS = 60;
const KV_TTL_SECONDS = 3600;

export async function getFacetOptionsCached(): Promise<FacetOptions> {
  const cache = cacheKv();
  if (cache) {
    try {
      const hit = await cache.get<FacetOptions>(CACHE_KEY, {
        type: "json",
        cacheTtl: EDGE_TTL_SECONDS,
      });
      if (hit) return hit;
    } catch {
      // fall through to the database on cache errors
    }
  }

  const options = await getFacetOptions();

  if (cache) {
    try {
      await cache.put(CACHE_KEY, JSON.stringify(options), {
        expirationTtl: KV_TTL_SECONDS,
      });
    } catch {
      // serving fresh options matters more than caching them
    }
  }
  return options;
}
