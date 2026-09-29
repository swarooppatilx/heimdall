import { useQuery } from "@tanstack/react-query";
import type { SyncStatus } from "@/lib/api-types";
import { MS_PER_MINUTE } from "@/lib/time";

const STALE_AFTER_MINUTES = 120;
const STALE_AFTER_MS = STALE_AFTER_MINUTES * MS_PER_MINUTE;
const REFRESH_MINUTES = 5;

export function useSyncStatus() {
  const { data } = useQuery<SyncStatus>({
    queryKey: ["syncStatus"],
    queryFn: async () => {
      const res = await fetch("/api/sync");
      if (!res.ok) throw new Error(`sync status request failed: ${res.status}`);
      return res.json() as Promise<SyncStatus>;
    },
    refetchInterval: REFRESH_MINUTES * MS_PER_MINUTE,
  });

  const syncedAt = data?.syncedAt ?? undefined;
  const syncStale = syncedAt ? Date.now() - new Date(syncedAt).getTime() > STALE_AFTER_MS : false;

  return { syncedAt, syncStale };
}
