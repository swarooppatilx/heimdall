import { NextResponse } from "next/server";
import { getCrawlHistory, getLatestCrawls } from "@/lib/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limit = checkRateLimit(request, { windowMs: 60_000, max: 30 });
  if (!limit.allowed) return rateLimitResponse(limit.resetMs);

  const latest = await getLatestCrawls();
  const history = await getCrawlHistory();
  return NextResponse.json({ latest, history });
}
