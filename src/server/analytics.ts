import { getCloudflareContext } from "@opennextjs/cloudflare";

let cachedBinding: AnalyticsEngineDataset | undefined;

// Writes are fire-and-forget by design (writeDataPoint is synchronous), so
// tracking never hands callers a promise they could forget to handle.
function getAnalyticsBinding(): AnalyticsEngineDataset | undefined {
  if (cachedBinding) return cachedBinding;
  try {
    cachedBinding = getCloudflareContext().env.ANALYTICS;
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
  skipped: number;
  sweep: number;
}

export function trackCrawlTick(data: CrawlTickData): void {
  const ae = getAnalyticsBinding();
  if (!ae) return;
  ae.writeDataPoint({
    indexes: ["crawl_tick"],
    blobs: [`sweep_${data.sweep}`, data.failed > 0 ? "partial" : "ok"],
    doubles: [
      data.durationMs,
      data.companies,
      data.ok,
      data.failed,
      data.discovered,
      // Former removed/deduped slots, kept so existing column positions hold.
      0,
      0,
      data.skipped,
    ],
  });
}

interface CrawlCleanupData {
  removed: number;
  deduped: number;
}

/** Written once per sweep by the cron, which owns stale-job removal and dedupe. */
export function trackCrawlCleanup(data: CrawlCleanupData): void {
  const ae = getAnalyticsBinding();
  if (!ae) return;
  ae.writeDataPoint({
    indexes: ["crawl_cleanup"],
    doubles: [data.removed, data.deduped],
  });
}

interface ApiRequestData {
  path: string;
  durationMs: number;
  status: number;
}

export function trackApiRequest(data: ApiRequestData): void {
  const ae = getAnalyticsBinding();
  if (!ae) return;
  ae.writeDataPoint({
    indexes: ["api_request"],
    blobs: [data.path, String(data.status)],
    doubles: [data.durationMs],
  });
}
