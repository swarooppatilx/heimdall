import { NextResponse } from "next/server";
import { type CrawlRecord, getCrawlHistory, getLatestCrawls } from "@/lib/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface PublicCrawlStatus {
  company: string;
  status: string;
  jobsFound: number;
  durationMs: number;
  createdAt: string;
}

function toPublic({
  company,
  status,
  jobsFound,
  durationMs,
  createdAt,
}: CrawlRecord): PublicCrawlStatus {
  return { company, status, jobsFound, durationMs, createdAt };
}

export async function GET(request: Request) {
  const limit = await checkRateLimit(request, {
    binding: "STATUS_RATE_LIMITER",
    windowMs: 60_000,
    max: 30,
  });
  if (!limit.allowed) return rateLimitResponse(limit.resetMs);

  const [latest, history] = await Promise.all([getLatestCrawls(), getCrawlHistory()]);
  return NextResponse.json({
    latest: latest.map(toPublic),
    history: history.map(toPublic),
  });
}
