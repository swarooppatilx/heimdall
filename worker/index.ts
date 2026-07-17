import { assessBoards, driftedBoards } from "../src/lib/board-health";
import { crawlAll, shouldRunTick, sweepOrdinal, sweepSlice } from "../src/lib/crawler";
import {
  bindDb,
  dedupeCrossSourceJobs,
  deleteOldCrawls,
  deleteStaleJobs,
  getJobQuality,
  getLatestCrawlUnix,
  getRecentCrawlSamples,
} from "../src/lib/db";
import { configureFreshness } from "../src/lib/freshness";
import { getRegistry } from "../src/lib/registry";
import handler from "./open-next-handler.mjs";

interface ScheduledController {
  cron: string;
  scheduledTime: number;
  noRetry(): void;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

const STALE_ALERT_MS = 30 * 60 * 1000;
const DRIFT_WINDOW_HOURS = 48;
const DRIFT_MIN_EMPTY = 6;
const CRAWL_RETENTION_DAYS = 45;

export default {
  fetch: handler.fetch,
  scheduled(controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    ctx.waitUntil(
      runTick(controller, env).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.log(JSON.stringify({ event: "crawl_failed", error: message }));
      }),
    );
  },
};

async function runTick(controller: ScheduledController, env: CloudflareEnv): Promise<void> {
  bindDb(env.DB);
  configureFreshness(env.FRESHNESS_DAYS);

  const lastCrawlAt = await getLatestCrawlUnix();
  if (!shouldRunTick(lastCrawlAt, Date.now())) {
    console.log(JSON.stringify({ event: "tick_skipped", lastCrawlAt }));
    return;
  }

  const run = await crawlAll(sweepSlice(getRegistry(), controller.scheduledTime));
  const sweepStart = sweepOrdinal(controller.scheduledTime) === 0;
  const removed = sweepStart ? await deleteStaleJobs() : 0;
  const deduped = sweepStart ? await dedupeCrossSourceJobs() : 0;
  const expiredCrawls = sweepStart ? await deleteOldCrawls(CRAWL_RETENTION_DAYS) : 0;
  const failed = run.results.filter((r) => r.status === "error").length;
  console.log(
    JSON.stringify({
      event: "scheduled_crawl",
      cron: controller.cron,
      companies: run.results.length,
      ok: run.results.length - failed,
      failed,
      discovered: run.discovered,
      removed,
      deduped,
      expiredCrawls,
      durationMs: run.durationMs,
    }),
  );

  const latestCrawlAt = await getLatestCrawlUnix();
  const stalenessMs = latestCrawlAt ? Date.now() - latestCrawlAt : null;
  if (stalenessMs === null || stalenessMs > STALE_ALERT_MS) {
    console.log(JSON.stringify({ event: "crawl_stale", lastCrawlAt: latestCrawlAt, stalenessMs }));
  }

  if (sweepStart) {
    const quality = await getJobQuality();
    console.log(JSON.stringify({ event: "job_quality", ...quality }));
    const drifted = driftedBoards(
      assessBoards(await getRecentCrawlSamples(DRIFT_WINDOW_HOURS)),
      DRIFT_MIN_EMPTY,
    );
    if (drifted.length > 0) {
      console.log(
        JSON.stringify({
          event: "board_drift",
          boards: drifted.map((b) => ({
            company: b.company,
            consecutiveEmpty: b.consecutiveEmpty,
          })),
        }),
      );
    }
  }
}
