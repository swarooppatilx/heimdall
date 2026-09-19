import { kvCacheAside, warmKvCache } from "@/lib/kv-cache";
import { trackKvCache } from "@/modules/analytics/analytics";
import { type FacetOptions, getFacetOptions } from "@/server/jobs/facets";

const CACHE_KEY = "facet-options";
const EDGE_TTL_SECONDS = 300;
const KV_TTL_SECONDS = 3600;

export function getFacetOptionsCached(env: Pick<CloudflareEnv, "CACHE">): Promise<FacetOptions> {
  return kvCacheAside({
    env,
    key: CACHE_KEY,
    edgeTtlSeconds: EDGE_TTL_SECONDS,
    kvTtlSeconds: KV_TTL_SECONDS,
    loader: getFacetOptions,
    onTrack: trackKvCache,
  });
}

export function warmFacetCache(env: Pick<CloudflareEnv, "CACHE">): Promise<void> {
  return warmKvCache(env, CACHE_KEY, KV_TTL_SECONDS, getFacetOptions);
}
