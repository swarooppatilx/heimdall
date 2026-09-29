import { NextResponse } from "next/server";
import { trackApiRequest } from "@/server/analytics";
import { withShortCacheHeaders } from "@/server/api/cache-headers";
import { defineRoute } from "@/server/api/define-route";
import { getSyncStatus } from "@/server/crawl/status";

export const dynamic = "force-dynamic";

const SYNC_CACHE_SECONDS = 60;

export const GET = defineRoute(
  { binding: "FILTERS_RATE_LIMITER", onRequest: trackApiRequest },
  async () => withShortCacheHeaders(NextResponse.json(await getSyncStatus()), SYNC_CACHE_SECONDS),
);
