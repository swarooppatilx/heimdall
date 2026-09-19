import { desc, sql } from "drizzle-orm";
import { MS_PER_SECOND } from "@/lib/time";
import type { CrawlSample } from "@/modules/crawl/board-health";
import type { CrawlStatusEntry } from "@/modules/crawl/status";
import { getDb } from "@/server/db";
import { crawls } from "@/server/db/schema";

const STATUS_SAMPLE_LIMIT = 100;

export async function recordCrawl(
  company: string,
  status: "ok" | "error",
  jobsFound: number,
  durationMs: number,
  error?: string,
): Promise<void> {
  const db = await getDb();
  await db.insert(crawls).values({
    company,
    status,
    jobsFound,
    durationMs,
    error: error ?? null,
  });
}

export async function getLatestCrawlUnix(): Promise<number | null> {
  const db = await getDb();
  const [row] = await db
    .select({ latest: sql<string | null>`strftime('%s', max(${crawls.createdAt}))` })
    .from(crawls);
  const latest = row?.latest;
  return latest ? Number(latest) * MS_PER_SECOND : null;
}

function toCrawlStatusEntry(row: typeof crawls.$inferSelect): CrawlStatusEntry {
  return {
    company: row.company,
    status: row.status as "ok" | "error",
    jobsFound: row.jobsFound,
    durationMs: row.durationMs,
    error: row.error,
    createdAt: row.createdAt,
  };
}

export async function getCrawlHistory(): Promise<CrawlStatusEntry[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(crawls)
    .orderBy(desc(crawls.createdAt))
    .limit(STATUS_SAMPLE_LIMIT);
  return rows.map(toCrawlStatusEntry);
}

export async function getLatestCrawls(): Promise<CrawlStatusEntry[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(crawls)
    .where(sql`id IN (SELECT MAX(id) FROM ${crawls} GROUP BY company)`)
    .orderBy(desc(crawls.createdAt));
  return rows.map(toCrawlStatusEntry);
}

export async function getRecentCrawlSamples(hours: number): Promise<CrawlSample[]> {
  const db = await getDb();
  const rows = await db
    .select({
      company: crawls.company,
      status: crawls.status,
      jobsFound: crawls.jobsFound,
    })
    .from(crawls)
    .where(sql`${crawls.createdAt} >= datetime('now', ${`-${hours} hours`})`)
    .orderBy(desc(crawls.id));
  return rows;
}

export async function deleteOldCrawls(days: number): Promise<number> {
  const db = await getDb();
  const result = await db.run(
    sql`DELETE FROM crawls WHERE created_at < datetime('now', ${`-${days} days`})`,
  );
  return result.meta?.changes ?? 0;
}
