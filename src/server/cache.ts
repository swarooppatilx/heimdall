import { formatError, logError } from "@/server/logger";

export interface CacheOptions<T> {
  env: Pick<CloudflareEnv, "CACHE">;
  key: string;
  edgeTtlSeconds: number;
  loader: () => Promise<T>;
}

/**
 * Cache-aside over KV for values the cron owns. Keys never expire: the cron
 * overwrites them after each crawl that changes data, so a miss only happens
 * before the first warm and the fill write is rare (KV allows 1,000 writes/day).
 */
export async function cached<T>(options: CacheOptions<T>): Promise<T> {
  const { env, key, edgeTtlSeconds, loader } = options;
  const cache = env.CACHE;

  if (cache) {
    try {
      const hit = await cache.get<T>(key, { type: "json", cacheTtl: edgeTtlSeconds });
      if (hit) return hit;
    } catch (err) {
      logError("kv_read_failed", { key, error: formatError(err) });
    }
  }

  const data = await loader();

  if (cache) {
    try {
      await cache.put(key, JSON.stringify(data));
    } catch (err) {
      logError("kv_write_failed", { key, error: formatError(err) });
    }
  }

  return data;
}

export async function refreshCache<T>(options: CacheOptions<T>): Promise<void> {
  const { env, key, loader } = options;
  const cache = env.CACHE;
  if (!cache) return;

  try {
    const data = await loader();
    await cache.put(key, JSON.stringify(data));
  } catch (err) {
    logError("kv_refresh_failed", { key, error: formatError(err) });
  }
}
