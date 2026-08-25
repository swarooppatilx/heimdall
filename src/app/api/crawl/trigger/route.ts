import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { crawlSlices } from "@/lib/crawler";
import { bindDb, getAllFreshJobs } from "@/lib/db";
import { warmFacetCache } from "@/lib/facet-cache";
import { configureFreshness } from "@/lib/freshness";
import { writeAllJobsToKV } from "@/lib/jobs-kv";
import { constantTimeEqual } from "@/lib/utils";
import { withRateLimit } from "@/lib/with-rate-limit";

export const dynamic = "force-dynamic";

const MAX_SLICES = 16;
const DEFAULT_SLICES = 1;

async function authorized(request: Request): Promise<boolean> {
  const { env } = await getCloudflareContext();
  const expected = (env as unknown as Record<string, string>).CRAWL_TRIGGER_TOKEN;
  if (!expected) return false;
  const provided = request.headers.get("x-crawl-trigger-token");
  if (!provided) return false;
  return constantTimeEqual(expected, provided);
}

function parseSlices(url: URL): number {
  const raw = Number(url.searchParams.get("slices") ?? DEFAULT_SLICES);
  if (!Number.isInteger(raw) || raw < 1) return DEFAULT_SLICES;
  return Math.min(raw, MAX_SLICES);
}

export const POST = withRateLimit(
  { binding: "STATUS_RATE_LIMITER", windowMs: 60_000, max: 30 },
  async (request) => {
    if (!(await authorized(request))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { env } = await getCloudflareContext();
    bindDb(env.DB);
    configureFreshness((env as unknown as Record<string, string>).FRESHNESS_DAYS);

    const start = Date.now();
    const slices = parseSlices(new URL(request.url));
    const runs = await crawlSlices(slices);

    const allJobs = await getAllFreshJobs();
    await writeAllJobsToKV(allJobs, env);
    await warmFacetCache(env);

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
      jobs: allJobs.length,
    });
  },
);
