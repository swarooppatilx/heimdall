import { diffJobs, isSuspiciousDeletion } from "@/server/crawl/diff";
import { boardIdPrefix, fetchJobs } from "@/server/crawl/fetch-jobs";
import { type CrawlBudget, chargeD1 } from "@/server/crawl/http";
import { boardKey, type Source } from "@/server/crawl/sources";
import { getValidator, recordCrawl } from "@/server/crawl/store";
import { getJobsByIdPrefix } from "@/server/jobs/queries";
import { deleteJobsByIds, insertJobs, updateJobs } from "@/server/jobs/writes";
import { formatError, logError, logEvent } from "@/server/logger";

const BOARD_READS = 2;
const STATUS_WRITES = 1;

export interface BoardCrawlResult {
  board: string;
  status: "ok" | "error";
  jobsFound: number;
  durationMs: number;
  wrote: boolean;
  error?: string;
}

export async function crawlBoard(entry: Source, budget?: CrawlBudget): Promise<BoardCrawlResult> {
  const start = Date.now();
  try {
    const existing = await getJobsByIdPrefix(boardIdPrefix(entry));
    const validator = await getValidator(boardKey(entry));
    // Two reads above and the status write at the end share the budget with fetches.
    chargeD1(budget, BOARD_READS + STATUS_WRITES);
    const fetched = await fetchJobs(entry, budget, validator ?? undefined);

    if (fetched === undefined) {
      const durationMs = Date.now() - start;
      await recordSafe({
        entry,
        status: "ok",
        jobsFound: existing.length,
        durationMs,
        ...(validator ? { validator } : {}),
      });
      return {
        board: boardKey(entry),
        status: "ok",
        jobsFound: existing.length,
        durationMs,
        wrote: false,
      };
    }

    const diff = diffJobs(existing, fetched.jobs);
    // A partial fetch says nothing about the jobs it didn't reach, and a mass
    // deletion on a full fetch is more likely a broken ATS response than reality.
    const suspicious =
      fetched.complete && isSuspiciousDeletion(existing.length, diff.deletedIds.length);
    const deletes = fetched.complete && !suspicious ? diff.deletedIds : [];
    // Counts only writes that actually run, so a skipped deletion doesn't
    // trigger a KV rebuild and cache purge for nothing.
    const wrote = diff.inserts.length > 0 || diff.updates.length > 0 || deletes.length > 0;

    chargeD1(budget, await insertJobs(diff.inserts));
    chargeD1(budget, await updateJobs(diff.updates));
    chargeD1(budget, await deleteJobsByIds(deletes));
    if (suspicious) {
      logEvent("suspicious_diff", {
        board: boardKey(entry),
        existing: existing.length,
        deleted: diff.deletedIds.length,
      });
    }

    const durationMs = Date.now() - start;
    await recordSafe({
      entry,
      status: "ok",
      jobsFound: fetched.jobs.length,
      durationMs,
      changed: wrote,
      ...(fetched.validator ? { validator: fetched.validator } : {}),
    });
    return {
      board: boardKey(entry),
      status: "ok",
      jobsFound: fetched.jobs.length,
      durationMs,
      wrote,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const msg = formatError(err);
    await recordSafe({ entry, status: "error", jobsFound: 0, durationMs, error: msg });
    return {
      board: boardKey(entry),
      status: "error",
      jobsFound: 0,
      durationMs,
      wrote: false,
      error: msg,
    };
  }
}

interface RecordSafeOptions {
  entry: Source;
  status: "ok" | "error";
  jobsFound: number;
  durationMs: number;
  error?: string;
  validator?: string;
  changed?: boolean;
}

function recordSafe(options: RecordSafeOptions): Promise<void> {
  const { entry, status, jobsFound, durationMs, error, validator, changed } = options;
  return recordCrawl({
    board: boardKey(entry),
    status,
    jobsFound,
    durationMs,
    changed: changed ?? false,
    ...(error ? { error } : {}),
    ...(validator ? { validator } : {}),
  }).catch((err: unknown) => {
    logError("crawl_record_failed", { board: boardKey(entry), error: formatError(err) });
  });
}
