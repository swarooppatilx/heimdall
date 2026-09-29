import { and, asc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { chunk } from "@/lib/chunk";
import { getDb } from "@/server/db";
import { boardStatus, sources } from "@/server/db/schema";

export interface Source {
  name: string;
  provider: string;
  label?: string;
}

// D1 caps bound parameters at 100 per statement.
const KEY_PAGE_SIZE = 90;

/** Stable key for one board: the same token can exist on several providers. */
export function boardKey(source: Source): string {
  return `${source.provider}/${source.name}`;
}

function toSource(row: { name: string; provider: string; label: string | null }): Source {
  return { name: row.name, provider: row.provider, ...(row.label ? { label: row.label } : {}) };
}

const columns = { name: sources.name, provider: sources.provider, label: sources.label };

/** Every board the cron should crawl, in a stable order so sweep slices are deterministic. */
export async function listCrawlableSources(): Promise<Source[]> {
  const db = await getDb();
  const rows = await db
    .select(columns)
    .from(sources)
    .where(ne(sources.status, "dead"))
    .orderBy(asc(sources.board));
  return rows.map(toSource);
}

export async function getSourcesByKeys(keys: string[]): Promise<Source[]> {
  const db = await getDb();
  const found: Source[] = [];
  for (const page of chunk(keys, KEY_PAGE_SIZE)) {
    const rows = await db.select(columns).from(sources).where(inArray(sources.board, page));
    found.push(...rows.map(toSource));
  }
  return found;
}

/**
 * Marks boards that keep crawling empty as degraded and restores them once
 * they return jobs. Only rows whose status changes are written.
 */
export async function markSourceHealth(minEmpty: number): Promise<void> {
  const db = await getDb();
  const drifted = db
    .select({ board: boardStatus.board })
    .from(boardStatus)
    .where(gte(boardStatus.consecutiveEmpty, minEmpty));
  await db.batch([
    db
      .update(sources)
      .set({ status: "degraded" })
      .where(and(eq(sources.status, "active"), inArray(sources.board, drifted))),
    db
      .update(sources)
      .set({ status: "active" })
      .where(and(eq(sources.status, "degraded"), sql`${sources.board} NOT IN ${drifted}`)),
  ]);
}
