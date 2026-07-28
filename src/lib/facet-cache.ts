import { getCloudflareContext } from "@opennextjs/cloudflare";
import { type FacetOptions, getFacetOptions } from "./facets";

const CACHE_KEY = "facet-options";
const EDGE_TTL_SECONDS = 60;
const KV_TTL_SECONDS = 3600;

function cacheBinding(): KVNamespace | undefined {
  try {
    const { env } = getCloudflareContext();
    return (env as { CACHE?: KVNamespace }).CACHE;
  } catch {
    return undefined;
  }
}

export async function getFacetOptionsCached(): Promise<FacetOptions> {
  const cache = cacheBinding();
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
