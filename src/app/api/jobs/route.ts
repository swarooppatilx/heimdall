import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { formatError, logEvent } from "@/lib/logger";
import { withRateLimit } from "@/lib/with-rate-limit";
import { readAllJobsFromKV, writeAllJobsToKV } from "@/modules/jobs/kv";
import { getAllFreshJobs, searchJobsWithCount } from "@/modules/jobs/queries";
import { searchJobs } from "@/modules/jobs/search";
import { type JobFilters, type PageOptions, POSTED_WINDOWS } from "@/modules/jobs/types";

export const dynamic = "force-dynamic";

const MAX_OFFSET = 10_000;
const SEARCH_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

function parseIntParam(searchParams: URLSearchParams, key: string): number | undefined {
  const value = Number.parseInt(searchParams.get(key) ?? "", 10);
  return Number.isNaN(value) ? undefined : value;
}

export const GET = withRateLimit(
  { binding: "JOBS_RATE_LIMITER", windowMs: 60_000, max: 100 },
  async (request) => {
    const { searchParams } = new URL(request.url);

    const filters: JobFilters = {};
    const filterParams = [
      ["q", "q"],
      ["company", "company"],
      ["location", "location"],
      ["city", "city"],
      ["country", "country"],
      ["source", "source"],
      ["experience", "experience"],
      ["posted", "posted"],
      ["department", "department"],
      ["early_career", "earlyCareer"],
      ["sort", "sort"],
    ] as const;
    for (const [param, field] of filterParams) {
      const value = searchParams.get(param);
      if (value) filters[field] = value;
    }

    const page: PageOptions = {};
    const pageLimit = parseIntParam(searchParams, "limit");
    const pageOffset = parseIntParam(searchParams, "offset");
    if (pageLimit !== undefined) page.limit = pageLimit;
    if (pageOffset !== undefined) page.offset = pageOffset;

    if (filters.posted && !POSTED_WINDOWS.includes(filters.posted)) {
      return NextResponse.json({ error: "invalid posted window" }, { status: 400 });
    }

    if ((pageOffset ?? 0) > MAX_OFFSET) {
      return NextResponse.json({ error: "offset too large" }, { status: 400 });
    }

    const { ctx, env } = await getCloudflareContext();
    const allJobs = await readAllJobsFromKV(env);
    if (allJobs) {
      const result = searchJobs(allJobs, filters, page);
      return NextResponse.json(result.jobs, {
        headers: { "X-Total-Count": String(result.total), ...SEARCH_CACHE_HEADERS },
      });
    }

    const { jobs, total } = await searchJobsWithCount(filters, page);

    ctx.waitUntil(
      getAllFreshJobs()
        .then((fresh) => writeAllJobsToKV(fresh, env))
        .catch((err) => {
          logEvent("kv_rewarm_failed", { error: formatError(err) });
        }),
    );

    return NextResponse.json(jobs, {
      headers: { "X-Total-Count": String(total), ...SEARCH_CACHE_HEADERS },
    });
  },
);
