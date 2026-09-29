import type { SyncStatus } from "@/lib/api-types";
import { getLatestCrawlUnix } from "@/server/crawl/store";

export const DRIFT_MIN_EMPTY = 6;

export async function getSyncStatus(): Promise<SyncStatus> {
  const latest = await getLatestCrawlUnix();
  return { syncedAt: latest ? new Date(latest).toISOString() : null };
}
