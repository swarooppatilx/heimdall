import type { CrawlStatusEntry } from "@/modules/crawl/status";

export function toIsoUtc(dbTimestamp: string): string {
  return new Date(`${dbTimestamp.replace(" ", "T")}Z`).toISOString();
}

export function toPublic(entry: CrawlStatusEntry): CrawlStatusEntry {
  return { ...entry, createdAt: toIsoUtc(entry.createdAt) };
}
