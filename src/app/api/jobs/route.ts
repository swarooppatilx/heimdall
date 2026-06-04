import { NextResponse } from "next/server";
import { fetchJobs } from "@/lib/fetch-jobs";
import { getRegistry } from "@/lib/registry";

export async function GET() {
  const registry = getRegistry();
  const results = await Promise.allSettled(
    registry.map((entry) => fetchJobs(entry)),
  );

  const jobs = results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchJobs>>> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());

  return NextResponse.json(jobs);
}
