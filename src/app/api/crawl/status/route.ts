import { NextResponse } from "next/server";
import { assessBoards, driftedBoards } from "@/lib/board-health";
import {
  type CrawlRecord,
  getCrawlHistory,
  getLatestCrawls,
  getRecentCrawlSamples,
} from "@/lib/db";
import { withRateLimit } from "@/lib/with-rate-limit";

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

// D1 datetime('now') is UTC but carries no zone suffix; without the marker
// browsers parse it as local time and "synced" ages inflate by the UTC offset.
function toIsoUtc(dbTimestamp: string): string {
  return new Date(`${dbTimestamp.replace(" ", "T")}Z`).toISOString();
}

function toPublic({
  company,
  status,
  jobsFound,
  durationMs,
  createdAt,
}: CrawlRecord): PublicCrawlStatus {
  return { company, status, jobsFound, durationMs, createdAt: toIsoUtc(createdAt) };
}

export const GET = withRateLimit(
  { binding: "STATUS_RATE_LIMITER", windowMs: 60_000, max: 30 },
  async () => {
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
  },
);
