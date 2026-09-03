import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { assessBoards, driftedBoards } from "@/lib/board-health";
import { constantTimeEqual } from "@/lib/security";
import { withRateLimit } from "@/lib/with-rate-limit";
import { DRIFT_MIN_EMPTY, DRIFT_WINDOW_HOURS } from "@/modules/crawl/drift";
import { toPublic } from "@/modules/crawl/helpers";
import { getCrawlStatusCached } from "@/modules/crawl/status-cache";
import { getCrawlHistory, getLatestCrawls, getRecentCrawlSamples } from "@/modules/crawl/store";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  const { env } = await getCloudflareContext();
  const expected = (env as unknown as Record<string, string>).CRAWL_STATUS_TOKEN;
  if (!expected) return true;
  const provided = request.headers.get("x-crawl-status-token");
  if (!provided) return false;
  return constantTimeEqual(expected, provided);
}

export const GET = withRateLimit(
  { binding: "STATUS_RATE_LIMITER", windowMs: 60_000, max: 30 },
  async (request) => {
    if (!(await authorized(request))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { env } = await getCloudflareContext();
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
