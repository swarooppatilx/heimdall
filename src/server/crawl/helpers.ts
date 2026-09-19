import type { CrawlStatusEntry } from "@/server/crawl/status";

export function toIsoUtc(dbTimestamp: string): string {
  return new Date(`${dbTimestamp.replace(" ", "T")}Z`).toISOString();
}

export function toPublic(entry: CrawlStatusEntry): CrawlStatusEntry {
  return { ...entry, createdAt: toIsoUtc(entry.createdAt) };
}
