import { NextResponse } from "next/server";
import type { JobFilters, PageOptions } from "@/lib/db";
import { searchJobsWithCount } from "@/lib/db";
import { POSTED_WINDOWS } from "@/lib/job-queries";
import {
  type JobFilters as KvJobFilters,
  readAllJobsFromKV,
  searchJobsFromKV,
} from "@/lib/jobs-kv";
import { withRateLimit } from "@/lib/with-rate-limit";

export const dynamic = "force-dynamic";

const MAX_OFFSET = 10_000;

function parseIntParam(searchParams: URLSearchParams, key: string): number | undefined {
  const value = Number.parseInt(searchParams.get(key) ?? "", 10);
  return Number.isNaN(value) ? undefined : value;
}

export const GET = withRateLimit(
  { binding: "JOBS_RATE_LIMITER", windowMs: 60_000, max: 100 },
  async (request) => {
    const { searchParams } = new URL(request.url);

    const filters: KvJobFilters = {};
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

    const allJobs = await readAllJobsFromKV();
    if (allJobs) {
      const result = searchJobsFromKV(allJobs, filters, page);
      return NextResponse.json(result.jobs, {
        headers: { "X-Total-Count": String(result.total) },
      });
    }

    const dbFilters: JobFilters = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value) dbFilters[key as keyof JobFilters] = value;
    }
    const { jobs, total } = await searchJobsWithCount(dbFilters, page);

    return NextResponse.json(jobs, { headers: { "X-Total-Count": String(total) } });
  },
);
