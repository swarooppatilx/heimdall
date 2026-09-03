import { useQuery } from "@tanstack/react-query";
import type { CrawlStatusEntry } from "@/modules/crawl/status";

const HOURS_PER_DAY = 24;
const MS_PER_HOUR = 3_600_000;
const STALE_SYNC_MS = HOURS_PER_DAY * MS_PER_HOUR;

export function useSyncStatus() {
  const { data: crawlStatus } = useQuery<{ latest: CrawlStatusEntry[] }>({
    queryKey: ["crawlStatus"],
    queryFn: async () => {
      const res = await fetch("/api/crawl/status");
      if (!res.ok) throw new Error(`crawl status request failed: ${res.status}`);
      return res.json() as Promise<{ latest: CrawlStatusEntry[] }>;
    },
  });

  const syncedAt = crawlStatus?.latest?.[0]?.createdAt;
  const syncStale = syncedAt ? Date.now() - new Date(syncedAt).getTime() > STALE_SYNC_MS : false;

  return { syncedAt, syncStale };
}
