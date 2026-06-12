import { NextResponse } from "next/server";
import { crawlAll } from "@/lib/crawler";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limit = checkRateLimit(request, { windowMs: 60_000, max: 5 });
  if (!limit.allowed) return rateLimitResponse(limit.resetMs);

  const results = await crawlAll();

  const synced = results.filter((r) => r.status === "ok").reduce((sum, r) => sum + r.jobsFound, 0);
  const errors = results.filter((r) => r.status === "error").map((r) => `${r.company}: ${r.error}`);

  return NextResponse.json({ synced, errors, results });
}
