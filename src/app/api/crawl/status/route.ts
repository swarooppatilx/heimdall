import { NextResponse } from "next/server";
import { assessBoards, driftedBoards } from "@/lib/board-health";
import {
  type CrawlRecord,
  getCrawlHistory,
  getLatestCrawls,
  getRecentCrawlSamples,
} from "@/lib/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const DRIFT_WINDOW_HOURS = 48;
const DRIFT_MIN_EMPTY = 6;

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

  const [latest, history, samples] = await Promise.all([
    getLatestCrawls(),
    getCrawlHistory(),
    getRecentCrawlSamples(DRIFT_WINDOW_HOURS),
  ]);
  const drifted = driftedBoards(assessBoards(samples), DRIFT_MIN_EMPTY).map(
    ({ company, consecutiveEmpty }) => ({ company, consecutiveEmpty }),
  );
  return NextResponse.json({
    latest: latest.map(toPublic),
    history: history.map(toPublic),
    drifted,
  });
}
