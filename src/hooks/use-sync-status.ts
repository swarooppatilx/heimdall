import { useQuery } from "@tanstack/react-query";
import { MS_PER_DAY } from "@/lib/time";
import type { CrawlStatusEntry } from "@/server/crawl/status";

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
  const syncStale = syncedAt ? Date.now() - new Date(syncedAt).getTime() > MS_PER_DAY : false;

  return { syncedAt, syncStale };
}
