import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { trackApiRequest } from "@/server/analytics";
import { withRateLimit } from "@/server/api/with-rate-limit";
import { getFacetOptionsCached } from "@/server/jobs/facet-cache";

export const dynamic = "force-dynamic";

export const GET = withRateLimit(
  { binding: "FILTERS_RATE_LIMITER", windowMs: 60_000, max: 30, onRequest: trackApiRequest },
  async () => {
    const { env } = await getCloudflareContext();
    return NextResponse.json(await getFacetOptionsCached(env));
  },
);
