import { getCloudflareContext } from "@opennextjs/cloudflare";
import { logEvent } from "@/lib/logger";

export function cacheKv(): KVNamespace | undefined {
  try {
    const { env } = getCloudflareContext();
    return (env as { CACHE?: KVNamespace }).CACHE;
  } catch (err) {
    logEvent("kv_cache_disabled", { error: String(err) });
    return undefined;
  }
}
