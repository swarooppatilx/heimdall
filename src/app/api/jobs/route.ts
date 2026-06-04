import { NextResponse } from "next/server";
import { fetchJobs } from "@/lib/fetch-jobs";
import { getRegistry } from "@/lib/registry";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.toLowerCase() ?? "";
  const company = searchParams.get("company")?.toLowerCase() ?? "";

  const registry = getRegistry();
  const results = await Promise.allSettled(registry.map((entry) => fetchJobs(entry)));

  let jobs = results
    .filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchJobs>>> =>
        r.status === "fulfilled",
    )
    .flatMap((r) => r.value);

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

  jobs.sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());

  return NextResponse.json(jobs);
}
