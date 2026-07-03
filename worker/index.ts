import { crawlAll, sweepOrdinal, sweepSlice } from "../src/lib/crawler";
import { bindDb, deleteStaleJobs } from "../src/lib/db";
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

export default {
  fetch: handler.fetch,
  scheduled(controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        bindDb(env.DB);
        const run = await crawlAll(sweepSlice(getRegistry(), controller.scheduledTime));
        const removed = sweepOrdinal(controller.scheduledTime) === 0 ? await deleteStaleJobs() : 0;
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
      })(),
    );
  },
};
