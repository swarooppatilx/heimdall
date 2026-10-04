import { eq, gte, sql } from "drizzle-orm";
import { MS_PER_SECOND } from "@/lib/time";
import { getDb, getReadDb } from "@/server/db";
import { boardStatus } from "@/server/db/schema";

interface RecordCrawlOptions {
  board: string;
  status: "ok" | "error";
  jobsFound: number;
  durationMs: number;
  error?: string | null;
  validator?: string | null;
  changed?: boolean;
}

/** Folds the crawl into the board's latest status. */
export async function recordCrawl(options: RecordCrawlOptions): Promise<void> {
  const db = await getDb();
  const { board, status, jobsFound, durationMs } = options;
  const error = options.error ?? null;
  await db
    .insert(boardStatus)
    .values({
      board,
      status,
      jobsFound,
      durationMs,
      error,
      validator: options.validator ?? null,
      consecutiveEmpty: status === "ok" && jobsFound === 0 ? 1 : 0,
      changedAt: options.changed ? sql`(datetime('now'))` : null,
    })
    .onConflictDoUpdate({
      target: boardStatus.board,
      set: {
        status,
        jobsFound,
        durationMs,
        error,
        validator: sql`coalesce(excluded.validator, ${boardStatus.validator})`,
        consecutiveEmpty: sql`case when excluded.consecutive_empty = 1 then ${boardStatus.consecutiveEmpty} + 1 else 0 end`,
        changedAt: sql`coalesce(excluded.changed_at, ${boardStatus.changedAt})`,
        crawledAt: sql`(datetime('now'))`,
      },
    });
}

export async function getValidator(board: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .select({ validator: boardStatus.validator })
    .from(boardStatus)
    .where(eq(boardStatus.board, board));
  return row?.validator ?? null;
}

/** Whether any crawl since `sinceMs` inserted, updated or deleted jobs. */
export async function hasChangesSince(sinceMs: number): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ board: boardStatus.board })
    .from(boardStatus)
    .where(
      gte(
        boardStatus.changedAt,
        sql`datetime(${Math.floor(sinceMs / MS_PER_SECOND)}, 'unixepoch')`,
      ),
    )
    .limit(1);
  return row !== undefined;
}

export async function getLatestCrawlUnix(): Promise<number | null> {
  const db = await getReadDb();
  const [row] = await db
    .select({ latest: sql<string | null>`strftime('%s', max(${boardStatus.crawledAt}))` })
    .from(boardStatus);
  const latest = row?.latest;
  return latest ? Number(latest) * MS_PER_SECOND : null;
}

/** Boards whose last `minEmpty` successful crawls in a row found nothing. */
export async function getDriftedBoards(
  minEmpty: number,
): Promise<{ board: string; consecutiveEmpty: number }[]> {
  const db = await getDb();
  return db
    .select({ board: boardStatus.board, consecutiveEmpty: boardStatus.consecutiveEmpty })
    .from(boardStatus)
    .where(gte(boardStatus.consecutiveEmpty, minEmpty));
}
