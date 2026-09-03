import { cacheKv } from "@/lib/cache-kv";
import { formatError, logEvent } from "@/lib/logger";
import { trackKvCache } from "@/modules/analytics/analytics";

interface KvCacheOptions<T> {
  env: Pick<CloudflareEnv, "CACHE">;
  key: string;
  edgeTtlSeconds: number;
  kvTtlSeconds: number;
  loader: () => Promise<T>;
}

export async function kvCacheAside<T>({
  env,
  key,
  edgeTtlSeconds,
  kvTtlSeconds,
  loader,
}: KvCacheOptions<T>): Promise<T> {
  const cache = cacheKv(env);
  if (cache) {
    try {
      const hit = await cache.get<T>(key, { type: "json", cacheTtl: edgeTtlSeconds });
      if (hit) {
        trackKvCache({ operation: "read", key, hit: true });
        return hit;
      }
    } catch (err) {
      logEvent("kv_read_failed", { key, error: formatError(err) });
    }
  }

  trackKvCache({ operation: "read", key, hit: false });
  const data = await loader();

  if (cache) {
    try {
      await cache.put(key, JSON.stringify(data), { expirationTtl: kvTtlSeconds });
    } catch (err) {
      logEvent("kv_write_failed", { key, error: formatError(err) });
    }
  }
  return data;
}

export async function warmKvCache<T>(
  env: Pick<CloudflareEnv, "CACHE">,
  key: string,
  kvTtlSeconds: number,
  loader: () => Promise<T>,
): Promise<void> {
  const cache = cacheKv(env);
  if (!cache) return;
  try {
    const data = await loader();
    await cache.put(key, JSON.stringify(data), { expirationTtl: kvTtlSeconds });
  } catch (err) {
    logEvent("kv_warm_failed", { key, error: formatError(err) });
  }
}
