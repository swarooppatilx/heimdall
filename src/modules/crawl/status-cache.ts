import { assessBoards, driftedBoards } from "@/lib/board-health";
import { cacheKv } from "@/lib/cache-kv";
import { formatError, logEvent } from "@/lib/logger";
import { trackKvCache } from "@/modules/analytics/analytics";
import { DRIFT_MIN_EMPTY, DRIFT_WINDOW_HOURS } from "@/modules/crawl/drift";
import { toPublic } from "@/modules/crawl/helpers";
import type { CrawlStatusEntry } from "@/modules/crawl/status";
import { getCrawlHistory, getLatestCrawls, getRecentCrawlSamples } from "@/modules/crawl/store";

const CACHE_KEY = "crawl-status";
const EDGE_TTL_SECONDS = 60;
const KV_TTL_SECONDS = 900;

export interface CrawlStatusPayload {
  latest: CrawlStatusEntry[];
  history: CrawlStatusEntry[];
  drifted: { company: string; consecutiveEmpty: number }[];
}

export async function getCrawlStatusCached(
  env: Pick<CloudflareEnv, "CACHE">,
  load: () => Promise<CrawlStatusPayload>,
): Promise<CrawlStatusPayload> {
  const cache = cacheKv(env);
  if (cache) {
    try {
      const hit = await cache.get<CrawlStatusPayload>(CACHE_KEY, {
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
  const payload = await load();

  if (cache) {
    try {
      await cache.put(CACHE_KEY, JSON.stringify(payload), {
        expirationTtl: KV_TTL_SECONDS,
      });
    } catch (err) {
      logEvent("kv_write_failed", { key: CACHE_KEY, error: formatError(err) });
    }
  }
  return payload;
}

export async function warmCrawlStatusCache(env: Pick<CloudflareEnv, "CACHE">): Promise<void> {
  const cache = cacheKv(env);
  if (!cache) return;
  try {
    const [latest, history, samples] = await Promise.all([
      getLatestCrawls(),
      getCrawlHistory(),
      getRecentCrawlSamples(DRIFT_WINDOW_HOURS),
    ]);
    const drifted = driftedBoards(assessBoards(samples), DRIFT_MIN_EMPTY).map(
      ({ company, consecutiveEmpty }) => ({ company, consecutiveEmpty }),
    );
    const payload: CrawlStatusPayload = {
      latest: latest.map(toPublic),
      history: history.map(toPublic),
      drifted,
    };
    await cache.put(CACHE_KEY, JSON.stringify(payload), {
      expirationTtl: KV_TTL_SECONDS,
    });
  } catch (err) {
    logEvent("kv_warm_failed", { key: CACHE_KEY, error: formatError(err) });
  }
}
