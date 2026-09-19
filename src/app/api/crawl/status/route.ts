import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { requireToken } from "@/app/api/_lib/auth";
import { withRateLimit } from "@/lib/with-rate-limit";
import { trackApiRequest } from "@/modules/analytics/analytics";
import { getCrawlStatusCached } from "@/server/crawl/status-cache";

export const dynamic = "force-dynamic";

export const GET = withRateLimit(
  { binding: "STATUS_RATE_LIMITER", windowMs: 60_000, max: 30, onRequest: trackApiRequest },
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
    const payload = await getCrawlStatusCached(env);
    return NextResponse.json(payload);
  },
);
