import { NextResponse } from "next/server";
import { searchJobs } from "@/lib/db";
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
  const jobs = await searchJobs({
    q: searchParams.get("q")?.toLowerCase() || undefined,
    company: searchParams.get("company")?.toLowerCase() || undefined,
    location: searchParams.get("location")?.toLowerCase() || undefined,
    source: searchParams.get("source")?.toLowerCase() || undefined,
    type: searchParams.get("type") || undefined,
    experience: searchParams.get("experience")?.toLowerCase() || undefined,
    posted: searchParams.get("posted") || undefined,
  });

  return NextResponse.json(jobs);
}
