import { NextResponse } from "next/server";
import { cacheKv, hashedCacheKey } from "@/lib/cache-kv";
import type { JobFilters, PageOptions } from "@/lib/db";
import { searchJobsWithCount } from "@/lib/db";
import type { Job } from "@/lib/job";
import { POSTED_WINDOWS } from "@/lib/job-queries";
import { withRateLimit } from "@/lib/with-rate-limit";

export const dynamic = "force-dynamic";

const EDGE_TTL_SECONDS = 300;
const MAX_OFFSET = 10_000;
const KV_TTL_SECONDS = 300;

interface CachedJobsPage {
  total: number;
  jobs: Job[];
}

function parseIntParam(searchParams: URLSearchParams, key: string): number | undefined {
  const value = Number.parseInt(searchParams.get(key) ?? "", 10);
  return Number.isNaN(value) ? undefined : value;
}

async function readCachedPage(key: string): Promise<CachedJobsPage | undefined> {
  const cache = cacheKv();
  if (!cache) return undefined;
  try {
    return (
      (await cache.get<CachedJobsPage>(key, {
        type: "json",
        cacheTtl: EDGE_TTL_SECONDS,
      })) ?? undefined
    );
  } catch {
    return undefined;
  }
}

async function writeCachedPage(key: string, page: CachedJobsPage): Promise<void> {
  const cache = cacheKv();
  if (!cache) return;
  try {
    await cache.put(key, JSON.stringify(page), { expirationTtl: KV_TTL_SECONDS });
  } catch {
    // a failed cache write must not fail the request
  }
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
      ["employment_type", "employmentType"],
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

    const cacheKey = await hashedCacheKey("jobs", request.url);
    const cached = await readCachedPage(cacheKey);
    if (cached) {
      return NextResponse.json(cached.jobs, {
        headers: { "X-Total-Count": String(cached.total) },
      });
    }

    const { jobs, total } = await searchJobsWithCount(filters, page);
    await writeCachedPage(cacheKey, { total, jobs });

    return NextResponse.json(jobs, { headers: { "X-Total-Count": String(total) } });
  },
);
