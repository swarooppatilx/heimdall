import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { requireToken } from "@/app/api/_lib/auth";
import { assessBoards, driftedBoards } from "@/lib/board-health";
import { withRateLimit } from "@/lib/with-rate-limit";
import { DRIFT_MIN_EMPTY, DRIFT_WINDOW_HOURS } from "@/modules/crawl/drift";
import { toPublic } from "@/modules/crawl/helpers";
import { getCrawlStatusCached } from "@/modules/crawl/status-cache";
import { getCrawlHistory, getLatestCrawls, getRecentCrawlSamples } from "@/modules/crawl/store";

export const dynamic = "force-dynamic";

export const GET = withRateLimit(
  { binding: "STATUS_RATE_LIMITER", windowMs: 60_000, max: 30 },
  async (request) => {
    const { env } = await getCloudflareContext();
    if (
      !requireToken(
        { env, envKey: "CRAWL_STATUS_TOKEN", headerKey: "x-crawl-status-token" },
        request,
      )
    ) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const payload = await getCrawlStatusCached(env, async () => {
      const [latest, history, samples] = await Promise.all([
        getLatestCrawls(),
        getCrawlHistory(),
        getRecentCrawlSamples(DRIFT_WINDOW_HOURS),
      ]);
      const drifted = driftedBoards(assessBoards(samples), DRIFT_MIN_EMPTY).map(
        ({ company, consecutiveEmpty }) => ({ company, consecutiveEmpty }),
      );
      return {
        latest: latest.map(toPublic),
        history: history.map(toPublic),
        drifted,
      };
    });
    return NextResponse.json(payload);
  },
);
