import type { CrawlStatusEntry } from "@/modules/crawl/status";
import type { CrawlRecord } from "@/modules/crawl/store";

export function toIsoUtc(dbTimestamp: string): string {
  return new Date(`${dbTimestamp.replace(" ", "T")}Z`).toISOString();
}

export function toPublic({
  company,
  status,
  jobsFound,
  durationMs,
  createdAt,
}: CrawlRecord): CrawlStatusEntry {
  return { company, status, jobsFound, durationMs, createdAt: toIsoUtc(createdAt) };
}
