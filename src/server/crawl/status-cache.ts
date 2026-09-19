import { kvCacheAside, warmKvCache } from "@/lib/kv-cache";
import { trackKvCache } from "@/modules/analytics/analytics";
import { assessBoards, driftedBoards } from "@/server/crawl/board-health";
import { DRIFT_MIN_EMPTY, DRIFT_WINDOW_HOURS } from "@/server/crawl/drift";
import { toPublic } from "@/server/crawl/helpers";
import type { CrawlStatusEntry } from "@/server/crawl/status";
import { getCrawlHistory, getLatestCrawls, getRecentCrawlSamples } from "@/server/crawl/store";

const CACHE_KEY = "crawl-status";
const EDGE_TTL_SECONDS = 60;
const KV_TTL_SECONDS = 900;

interface CrawlStatusPayload {
  latest: CrawlStatusEntry[];
  history: CrawlStatusEntry[];
  drifted: { company: string; consecutiveEmpty: number }[];
}

async function loadCrawlStatus(): Promise<CrawlStatusPayload> {
  const [latest, history, samples] = await Promise.all([
    getLatestCrawls(),
    getCrawlHistory(),
    getRecentCrawlSamples(DRIFT_WINDOW_HOURS),
  ]);
  const drifted = driftedBoards(assessBoards(samples), DRIFT_MIN_EMPTY).map(
    ({ company, consecutiveEmpty }) => ({ company, consecutiveEmpty }),
  );
  return {
    latest: latest.map(toPublic),
    history: history.map(toPublic),
    drifted,
  };
}

export function getCrawlStatusCached(
  env: Pick<CloudflareEnv, "CACHE">,
): Promise<CrawlStatusPayload> {
  return kvCacheAside({
    env,
    key: CACHE_KEY,
    edgeTtlSeconds: EDGE_TTL_SECONDS,
    kvTtlSeconds: KV_TTL_SECONDS,
    loader: loadCrawlStatus,
    onTrack: trackKvCache,
  });
}

export function warmCrawlStatusCache(env: Pick<CloudflareEnv, "CACHE">): Promise<void> {
  return warmKvCache(env, CACHE_KEY, KV_TTL_SECONDS, loadCrawlStatus);
}
