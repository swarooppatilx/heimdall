import { getCloudflareContext } from "@opennextjs/cloudflare";

let cachedBinding: AnalyticsEngineDataset | undefined;

async function getAnalyticsBinding(): Promise<AnalyticsEngineDataset | undefined> {
  if (cachedBinding) return cachedBinding;
  try {
    const { env } = await getCloudflareContext();
    cachedBinding = (env as CloudflareEnv).ANALYTICS;
    return cachedBinding;
  } catch {
    return undefined;
  }
}

export function setAnalyticsBinding(binding: AnalyticsEngineDataset): void {
  cachedBinding = binding;
}

interface CrawlTickData {
  durationMs: number;
  companies: number;
  ok: number;
  failed: number;
  discovered: number;
  removed: number;
  deduped: number;
  skipped: number;
  sweep: number;
}

export async function trackCrawlTick(data: CrawlTickData): Promise<void> {
  const ae = await getAnalyticsBinding();
  if (!ae) return;
  ae.writeDataPoint({
    indexes: ["crawl_tick"],
    blobs: ["crawl_tick", `sweep_${data.sweep}`, data.failed > 0 ? "partial" : "ok"],
    doubles: [
      data.durationMs,
      data.companies,
      data.ok,
      data.failed,
      data.discovered,
      data.removed,
      data.deduped,
      data.skipped,
    ],
  });
}

interface ApiRequestData {
  path: string;
  durationMs: number;
  status: number;
  kvHit: boolean;
}

export async function trackApiRequest(data: ApiRequestData): Promise<void> {
  const ae = await getAnalyticsBinding();
  if (!ae) return;
  ae.writeDataPoint({
    indexes: ["api_request"],
    blobs: [data.path, `${data.status}`, data.kvHit ? "hit" : "miss"],
    doubles: [data.durationMs],
  });
}

interface KvCacheData {
  operation: "read" | "write";
  key: string;
  hit: boolean;
}

export async function trackKvCache(data: KvCacheData): Promise<void> {
  const ae = await getAnalyticsBinding();
  if (!ae) return;
  ae.writeDataPoint({
    indexes: ["kv_cache"],
    blobs: [data.operation, data.key, data.hit ? "hit" : "miss"],
    doubles: [],
  });
}
