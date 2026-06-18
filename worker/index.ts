import { crawlAll, sweepSlice } from "../src/lib/crawler";
import { bindDb } from "../src/lib/db";
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
        const results = await crawlAll(sweepSlice(getRegistry(), controller.scheduledTime));
        const failed = results.filter((r) => r.status === "error").length;
        console.log(
          JSON.stringify({
            event: "scheduled_crawl",
            cron: controller.cron,
            companies: results.length,
            failed,
          }),
        );
      })(),
    );
  },
};
