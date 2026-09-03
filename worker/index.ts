import { bindDb } from "@/db";
import { formatError, logEvent } from "@/lib/logger";
import { setAnalyticsBinding, trackCrawlTick } from "@/modules/analytics/analytics";
import { warmAllCaches } from "@/modules/cache-warmer";
import { assessBoards, driftedBoards } from "@/modules/crawl/board-health";
import { DRIFT_MIN_EMPTY, DRIFT_WINDOW_HOURS } from "@/modules/crawl/drift";
import { getRegistry } from "@/modules/crawl/registry";
import { crawlAll, shouldRunTick, sweepOrdinal, sweepSlice } from "@/modules/crawl/scheduler";
import { warmCrawlStatusCache } from "@/modules/crawl/status-cache";
import { deleteOldCrawls, getLatestCrawlUnix, getRecentCrawlSamples } from "@/modules/crawl/store";
import { configureFreshness } from "@/modules/jobs/freshness";
import { getJobQuality } from "@/modules/jobs/quality";
import { dedupeCrossSourceJobs, deleteStaleJobs } from "@/modules/jobs/writes";
import handler from "./open-next-handler.mjs";

interface ScheduledController {
  cron: string;
  scheduledTime: number;
  noRetry(): void;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

// biome-ignore lint/style/noMagicNumbers: self-explanatory compound
const STALE_ALERT_MS = 30 * 60 * 1000;
const CRAWL_RETENTION_DAYS = 45;

export default {
  fetch: handler.fetch,
  scheduled(controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    ctx.waitUntil(
      runTick(controller, env).catch((err: unknown) => {
        logEvent("crawl_failed", { error: formatError(err) });
      }),
    );
  },
};

async function runTick(controller: ScheduledController, env: CloudflareEnv): Promise<void> {
  bindDb(env.DB);
  setAnalyticsBinding(env.ANALYTICS);
  configureFreshness(env.FRESHNESS_DAYS);

  const lastCrawlAt = await getLatestCrawlUnix();
  if (!shouldRunTick(lastCrawlAt, Date.now())) {
    logEvent("tick_skipped", { lastCrawlAt });
    return;
  }

  const run = await crawlAll(sweepSlice(getRegistry(), controller.scheduledTime));
  const sweepStart = sweepOrdinal(controller.scheduledTime) === 0;
  const removed = sweepStart ? await deleteStaleJobs() : 0;
  const deduped = sweepStart ? await dedupeCrossSourceJobs() : 0;
  const expiredCrawls = sweepStart ? await deleteOldCrawls(CRAWL_RETENTION_DAYS) : 0;

  await Promise.all([warmAllCaches(env), warmCrawlStatusCache(env)]);

  const failed = run.results.filter((r) => r.status === "error").length;
  logEvent("scheduled_crawl", {
    cron: controller.cron,
    companies: run.results.length,
    ok: run.results.length - failed,
    failed,
    discovered: run.discovered,
    removed,
    deduped,
    expiredCrawls,
    skipped: run.skipped,
    durationMs: run.durationMs,
  });

  trackCrawlTick({
    durationMs: run.durationMs,
    companies: run.results.length,
    ok: run.results.length - failed,
    failed,
    discovered: run.discovered,
    removed,
    deduped,
    skipped: run.skipped,
    sweep: sweepOrdinal(controller.scheduledTime),
  });

  const latestCrawlAt = await getLatestCrawlUnix();
  const stalenessMs = latestCrawlAt ? Date.now() - latestCrawlAt : null;
  if (stalenessMs === null || stalenessMs > STALE_ALERT_MS) {
    logEvent("crawl_stale", { lastCrawlAt: latestCrawlAt, stalenessMs });
  }

  if (sweepStart) {
    const quality = await getJobQuality();
    logEvent("job_quality", quality);
    const drifted = driftedBoards(
      assessBoards(await getRecentCrawlSamples(DRIFT_WINDOW_HOURS)),
      DRIFT_MIN_EMPTY,
    );
    if (drifted.length > 0) {
      logEvent("board_drift", {
        boards: drifted.map((b) => ({
          company: b.company,
          consecutiveEmpty: b.consecutiveEmpty,
        })),
      });
    }
  }
}
