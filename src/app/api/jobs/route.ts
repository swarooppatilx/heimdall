import { NextResponse } from "next/server";
import { toJobDto } from "@/lib/job";
import { parseJobSearchParams } from "@/lib/search-params";
import { trackApiRequest } from "@/server/analytics";
import { withCacheHeaders } from "@/server/api/cache-headers";
import { defineRoute } from "@/server/api/define-route";
import { searchJobsWithCount } from "@/server/jobs/queries";

export const dynamic = "force-dynamic";

export const GET = defineRoute(
  { binding: "JOBS_RATE_LIMITER", onRequest: trackApiRequest },
  async (request) => {
    const parsed = parseJobSearchParams(new URL(request.url).searchParams);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { filters, page } = parsed;

    const { jobs, total } = await searchJobsWithCount(filters, page);
    const response = NextResponse.json(jobs.map(toJobDto));
    if (total !== null) response.headers.set("X-Total-Count", String(total));
    return withCacheHeaders(response);
  },
);
