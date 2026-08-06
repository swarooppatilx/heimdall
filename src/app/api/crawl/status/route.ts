import { getCloudflareContext } from "@opennextjs/cloudflare";
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

function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] === right[i] ? 0 : 1;
  return diff === 0;
}

async function authorized(request: Request): Promise<boolean> {
  const { env } = await getCloudflareContext();
  const expected = (env as CloudflareEnv).CRAWL_STATUS_TOKEN;
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
