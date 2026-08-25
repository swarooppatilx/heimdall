import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { assessBoards, driftedBoards } from "@/lib/board-health";
import type { CrawlStatusEntry } from "@/lib/crawl-status";
import {
  type CrawlRecord,
  getCrawlHistory,
  getLatestCrawls,
  getRecentCrawlSamples,
} from "@/lib/db";
import { constantTimeEqual } from "@/lib/utils";
import { withRateLimit } from "@/lib/with-rate-limit";

export const dynamic = "force-dynamic";

const DRIFT_WINDOW_HOURS = 48;
const DRIFT_MIN_EMPTY = 6;

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
}: CrawlRecord): CrawlStatusEntry {
  return { company, status, jobsFound, durationMs, createdAt: toIsoUtc(createdAt) };
}

async function authorized(request: Request): Promise<boolean> {
  const { env } = await getCloudflareContext();
  const expected = (env as unknown as Record<string, string>).CRAWL_STATUS_TOKEN;
  if (!expected) return true;
  const provided = request.headers.get("x-crawl-status-token");
  if (!provided) return false;
  return constantTimeEqual(expected, provided);
}

export const GET = withRateLimit(
  { binding: "STATUS_RATE_LIMITER", windowMs: 60_000, max: 30 },
  async (request) => {
    if (!(await authorized(request))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
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
