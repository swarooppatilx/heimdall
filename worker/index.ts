import { MS_PER_MINUTE } from "@/lib/time";
import { setAnalyticsBinding, trackCrawlCleanup, trackCrawlTick } from "@/server/analytics";
import { setJobsCacheHeaders } from "@/server/api/cache-headers";
import { type CrawlMessage, enqueueBoards, handleCrawlBatch } from "@/server/crawl/queue";
import { sweepOrdinal, sweepSlice, TICK_MS } from "@/server/crawl/scheduler";
import { listCrawlableSources, markSourceHealth } from "@/server/crawl/sources";
import { DRIFT_MIN_EMPTY } from "@/server/crawl/status";
import { getDriftedBoards, getLatestCrawlUnix, hasChangesSince } from "@/server/crawl/store";
import { bindDb } from "@/server/db";
import { warmJobViews } from "@/server/jobs/cached-views";
import { configureFreshness } from "@/server/jobs/freshness";
import { dedupeCrossSourceJobs, deleteStaleJobs } from "@/server/jobs/writes";
import { formatError, logError, logEvent } from "@/server/logger";
import handler from "./open-next-handler.mjs";
import { purgeJobsCache } from "./purge";

const STALE_ALERT_MINUTES = 60;
const STALE_ALERT_MS = STALE_ALERT_MINUTES * MS_PER_MINUTE;
const HTML_BROWSER_MAX_AGE_SECONDS = 0;
const EDGE_CACHED_PAGES =
  /^\/(?:$|company\/|sitemap\.xml$|robots\.txt$|llms-full\.txt$|feed\.xml$)/;

function bindEnv(env: CloudflareEnv): void {
  bindDb(env.DB);
  setAnalyticsBinding(env.ANALYTICS);
  configureFreshness(env.FRESHNESS_DAYS);
}

// Next marks dynamic pages private; job pages only change when a crawl does,
// so they are cached at the edge and purged by tag after each crawl.
function withPageCache(request: Request, response: Response): Response {
  if (request.method !== "GET" || !response.ok) return response;
  const url = new URL(request.url);
  // Filtered URLs (`/?q=…`) are unbounded keys that rarely repeat; caching them
  // only spends the request budget and evicts the pages that do repeat.
  if (url.search || !EDGE_CACHED_PAGES.test(url.pathname)) return response;
  const cacheable = new Response(response.body, response);
  setJobsCacheHeaders(cacheable.headers, HTML_BROWSER_MAX_AGE_SECONDS);
  return cacheable;
}

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    return withPageCache(request, await handler.fetch(request, env, ctx));
  },
  scheduled(controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    ctx.waitUntil(
      runTick(controller, env).catch((err: unknown) => {
        logError("crawl_failed", { error: formatError(err) });
      }),
    );
  },
  async queue(batch: MessageBatch<CrawlMessage>, env: CloudflareEnv) {
    bindEnv(env);
    const runs = await handleCrawlBatch(batch, env.CRAWL_QUEUE);
    for (const run of runs) {
      const failed = run.results.filter((r) => r.status === "error").length;
      trackCrawlTick({
        durationMs: run.durationMs,
        companies: run.results.length,
        ok: run.results.length - failed,
        failed,
        discovered: run.discovered,
        skipped: run.skipped,
        sweep: sweepOrdinal(),
      });
    }
  },
};

async function runTick(controller: ScheduledController, env: CloudflareEnv): Promise<void> {
  bindEnv(env);

  const sweep = sweepOrdinal(controller.scheduledTime);
  const sweepStart = sweep === 0;
  const enqueued = await enqueueBoards(
    env.CRAWL_QUEUE,
    sweepSlice(await listCrawlableSources(), controller.scheduledTime),
  );

  const removed = sweepStart ? await deleteStaleJobs() : 0;
  const deduped = sweepStart ? await dedupeCrossSourceJobs() : 0;
  const crawlsChanged = await hasChangesSince(controller.scheduledTime - TICK_MS);
  const dataChanged = crawlsChanged || removed > 0 || deduped > 0;

  if (dataChanged) {
    await warmJobViews(env);
    await purgeJobsCache();
  }

  logEvent("scheduled_tick", {
    cron: controller.cron,
    sweep,
    enqueued,
    removed,
    deduped,
    dataChanged,
  });

  const latestCrawlAt = await getLatestCrawlUnix();
  const stalenessMs = latestCrawlAt ? Date.now() - latestCrawlAt : null;
  if (stalenessMs === null || stalenessMs > STALE_ALERT_MS) {
    logEvent("crawl_stale", { lastCrawlAt: latestCrawlAt, stalenessMs });
  }

  if (sweepStart) {
    trackCrawlCleanup({ removed, deduped });
    const drifted = await getDriftedBoards(DRIFT_MIN_EMPTY);
    if (drifted.length > 0) logEvent("board_drift", { boards: drifted });
    await markSourceHealth(DRIFT_MIN_EMPTY);
  }
}
