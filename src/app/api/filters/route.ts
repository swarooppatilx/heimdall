import { NextResponse } from "next/server";
import { getFacetOptions } from "@/lib/db";
import { withRateLimit } from "@/lib/with-rate-limit";

export const dynamic = "force-dynamic";

export const GET = withRateLimit(
  { binding: "FILTERS_RATE_LIMITER", windowMs: 60_000, max: 30 },
  async () => NextResponse.json(await getFacetOptions()),
);
