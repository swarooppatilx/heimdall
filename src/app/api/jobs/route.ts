import { NextResponse } from "next/server";
import { getAllJobs } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.toLowerCase() ?? "";
  const company = searchParams.get("company")?.toLowerCase() ?? "";
  const location = searchParams.get("location")?.toLowerCase() ?? "";
  const type = searchParams.get("type") ?? "";
  const experience = searchParams.get("experience")?.toLowerCase() ?? "";
  const posted = searchParams.get("posted") ?? "";
  const source = searchParams.get("source")?.toLowerCase() ?? "";

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

  if (source) {
    jobs = jobs.filter((job) => job.source.toLowerCase() === source);
  }

  if (type) {
    jobs = jobs.filter((job) => {
      const l = job.location.toLowerCase();
      if (type === "remote") return l.includes("remote");
      return true;
    });
  }

  if (experience) {
    jobs = jobs.filter((job) => job.experienceLevel === experience);
  }

  if (posted) {
    const now = Date.now();
    const ms: Record<string, number> = {
      today: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };
    const maxAge = ms[posted];
    if (maxAge) {
      jobs = jobs.filter((job) => now - job.postedAt.getTime() <= maxAge);
    }
  }

  return NextResponse.json(jobs);
}
