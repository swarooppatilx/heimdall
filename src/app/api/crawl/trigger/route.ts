import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { requireToken } from "@/app/api/_lib/auth";
import { withRateLimit } from "@/lib/with-rate-limit";
import { trackApiRequest } from "@/modules/analytics/analytics";
import { warmAllCaches } from "@/modules/cache-warmer";
import { crawlSlices } from "@/server/crawl/scheduler";
import { bindDb } from "@/server/db";
import { configureFreshness } from "@/server/jobs/freshness";

export const dynamic = "force-dynamic";

const MAX_SLICES = 16;
const DEFAULT_SLICES = 1;

function parseSlices(url: URL): number {
  const raw = Number(url.searchParams.get("slices") ?? DEFAULT_SLICES);
  if (!Number.isInteger(raw) || raw < 1) return DEFAULT_SLICES;
  return Math.min(raw, MAX_SLICES);
}

export const POST = withRateLimit(
  { binding: "STATUS_RATE_LIMITER", windowMs: 60_000, max: 30, onRequest: trackApiRequest },
  async (request) => {
    const { env } = await getCloudflareContext();
    if (
      !requireToken(
        { env, envKey: "CRAWL_TRIGGER_TOKEN", headerKey: "x-crawl-trigger-token" },
        request,
      )
    ) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    bindDb(env.DB);
    configureFreshness(env.FRESHNESS_DAYS);

    const start = Date.now();
    const slices = parseSlices(new URL(request.url));
    const runs = await crawlSlices(slices);

    const jobCount = await warmAllCaches(env);

    const ok = runs.reduce(
      (sum, run) => sum + run.results.filter((r) => r.status === "ok").length,
      0,
    );
    const failed = runs.reduce(
      (sum, run) => sum + run.results.filter((r) => r.status === "error").length,
      0,
    );
    const discovered = runs.reduce((sum, run) => sum + run.discovered, 0);

    return NextResponse.json({
      ok,
      failed,
      discovered,
      durationMs: Date.now() - start,
      slices,
      jobs: jobCount,
    });
  },
);
