import { NextResponse } from "next/server";
import { getAllJobs, upsertJobs } from "@/lib/db";
import { fetchJobs } from "@/lib/fetch-jobs";
import { getRegistry } from "@/lib/registry";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.toLowerCase() ?? "";
  const company = searchParams.get("company")?.toLowerCase() ?? "";
  const location = searchParams.get("location")?.toLowerCase() ?? "";

  const registry = getRegistry();
  const results = await Promise.allSettled(registry.map((entry) => fetchJobs(entry)));

  const freshJobs = results
    .filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchJobs>>> =>
        r.status === "fulfilled",
    )
    .flatMap((r) => r.value);

  if (freshJobs.length > 0) {
    upsertJobs(freshJobs);
  }

  let jobs = getAllJobs();

  if (query) {
    jobs = jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(query) ||
        job.location.toLowerCase().includes(query) ||
        job.department.toLowerCase().includes(query),
    );
  }

  if (company) {
    jobs = jobs.filter((job) => job.company.toLowerCase() === company);
  }

  if (location) {
    jobs = jobs.filter((job) => job.location.toLowerCase().includes(location));
  }

  return NextResponse.json(jobs);
}
