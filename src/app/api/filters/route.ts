import { NextResponse } from "next/server";
import { getFilterOptions } from "@/lib/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limit = checkRateLimit(request, { windowMs: 60_000, max: 100 });
  if (!limit.allowed) return rateLimitResponse(limit.resetMs);

  return NextResponse.json(await getFilterOptions());
}
