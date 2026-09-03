import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { withRateLimit } from "@/lib/with-rate-limit";
import { getFacetOptionsCached } from "@/modules/jobs/facet-cache";

export const dynamic = "force-dynamic";

export const GET = withRateLimit(
  { binding: "FILTERS_RATE_LIMITER", windowMs: 60_000, max: 30 },
  async () => {
    const { env } = await getCloudflareContext();
    return NextResponse.json(await getFacetOptionsCached(env));
  },
);
