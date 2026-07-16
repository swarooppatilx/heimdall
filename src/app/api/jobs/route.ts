import { NextResponse } from "next/server";
import type { JobFilters } from "@/lib/db";
import { countJobs, searchJobs } from "@/lib/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limit = await checkRateLimit(request, {
    binding: "JOBS_RATE_LIMITER",
    windowMs: 60_000,
    max: 100,
  });
  if (!limit.allowed) return rateLimitResponse(limit.resetMs);

  const { searchParams } = new URL(request.url);
  const parseIntParam = (key: string): number | undefined => {
    const value = Number.parseInt(searchParams.get(key) ?? "", 10);
    return Number.isNaN(value) ? undefined : value;
  };
  const filters: JobFilters = {
    q: searchParams.get("q") || undefined,
    company: searchParams.get("company") || undefined,
    location: searchParams.get("location") || undefined,
    city: searchParams.get("city") || undefined,
    country: searchParams.get("country") || undefined,
    source: searchParams.get("source") || undefined,
    experience: searchParams.get("experience") || undefined,
    posted: searchParams.get("posted") || undefined,
    department: searchParams.get("department") || undefined,
    employmentType: searchParams.get("employment_type") || undefined,
    earlyCareer: searchParams.get("early_career") || undefined,
    sort: searchParams.get("sort") || undefined,
  };

  const [jobs, total] = await Promise.all([
    searchJobs(filters, { limit: parseIntParam("limit"), offset: parseIntParam("offset") }),
    countJobs(filters),
  ]);

  return NextResponse.json(jobs, { headers: { "X-Total-Count": String(total) } });
}
