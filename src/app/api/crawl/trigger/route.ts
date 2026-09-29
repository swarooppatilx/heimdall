import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { trackApiRequest } from "@/server/analytics";
import { requireToken } from "@/server/api/auth";
import { withNoStore } from "@/server/api/cache-headers";
import { defineRoute } from "@/server/api/define-route";
import { enqueueBoards } from "@/server/crawl/queue";
import { TICKS_PER_SWEEP, upcomingBoards } from "@/server/crawl/scheduler";
import { listCrawlableSources } from "@/server/crawl/sources";

export const dynamic = "force-dynamic";

const DEFAULT_SLICES = 1;

function parseSlices(url: URL): number {
  const raw = Number(url.searchParams.get("slices") ?? DEFAULT_SLICES);
  if (!Number.isInteger(raw) || raw < 1) return DEFAULT_SLICES;
  return Math.min(raw, TICKS_PER_SWEEP);
}

export const POST = defineRoute(
  { binding: "STATUS_RATE_LIMITER", onRequest: trackApiRequest },
  async (request) => {
    const { env } = await getCloudflareContext();
    if (
      !requireToken(
        { env, envKey: "CRAWL_TRIGGER_TOKEN", headerKey: "x-crawl-trigger-token" },
        request,
      )
    ) {
      return withNoStore(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
    }

    // Previews have no queue binding, so they can never start a production crawl.
    if (!env.CRAWL_QUEUE) {
      return withNoStore(NextResponse.json({ error: "queue_unavailable" }, { status: 503 }));
    }

    const slices = parseSlices(new URL(request.url));
    const boards = upcomingBoards(await listCrawlableSources(), slices);
    const messages = await enqueueBoards(env.CRAWL_QUEUE, boards);
    return withNoStore(NextResponse.json({ slices, boards: boards.length, messages }));
  },
);
