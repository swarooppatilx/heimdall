import { crawlAll, sweepOrdinal, sweepSlice } from "../src/lib/crawler";
import { bindDb, deleteStaleJobs, getJobQuality, getLatestCrawlUnix } from "../src/lib/db";
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

export default {
  fetch: handler.fetch,
  scheduled(controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        bindDb(env.DB);
        const run = await crawlAll(sweepSlice(getRegistry(), controller.scheduledTime));
        const sweepStart = sweepOrdinal(controller.scheduledTime) === 0;
        const removed = sweepStart ? await deleteStaleJobs() : 0;
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
            durationMs: run.durationMs,
          }),
        );
        const lastCrawlAt = await getLatestCrawlUnix();
        const stalenessMs = lastCrawlAt ? Date.now() - lastCrawlAt : null;
        if (stalenessMs === null || stalenessMs > STALE_ALERT_MS) {
          console.log(JSON.stringify({ event: "crawl_stale", lastCrawlAt, stalenessMs }));
        }
        if (sweepStart) {
          const quality = await getJobQuality();
          console.log(JSON.stringify({ event: "job_quality", ...quality }));
        }
      })(),
    );
  },
};
