import { NextResponse } from "next/server";
import type { JobFilters, PageOptions } from "@/lib/db";
import { countJobs, searchJobs } from "@/lib/db";
import { withRateLimit } from "@/lib/with-rate-limit";

export const dynamic = "force-dynamic";

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

    const [jobs, total] = await Promise.all([searchJobs(filters, page), countJobs(filters)]);

    return NextResponse.json(jobs, { headers: { "X-Total-Count": String(total) } });
  },
);
