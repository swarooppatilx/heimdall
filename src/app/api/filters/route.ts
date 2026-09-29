import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { trackApiRequest } from "@/server/analytics";
import { withCacheHeaders } from "@/server/api/cache-headers";
import { defineRoute } from "@/server/api/define-route";
import { getFacetOptionsCached } from "@/server/jobs/cached-views";

export const dynamic = "force-dynamic";

export const GET = defineRoute(
  { binding: "FILTERS_RATE_LIMITER", onRequest: trackApiRequest },
  async () => {
    const { env } = await getCloudflareContext();
    return withCacheHeaders(NextResponse.json(await getFacetOptionsCached(env)));
  },
);
