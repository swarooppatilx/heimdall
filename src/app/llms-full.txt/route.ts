import { getAllFreshJobs } from "@/lib/job-queries";
import { siteUrl } from "@/lib/site";
import { withRateLimit } from "@/lib/with-rate-limit";

export const dynamic = "force-dynamic";

const MAX_JOBS = 200;

export const GET = withRateLimit(
  { binding: "JOBS_RATE_LIMITER", windowMs: 60_000, max: 60 },
  async () => {
    const url = await siteUrl();
    const jobs = (await getAllFreshJobs())
      .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime())
      .slice(0, MAX_JOBS);

    const lines = [
      "# heimdall fresh jobs",
      "",
      "Fresh verified roles from official company career pages and ATS providers.",
      "Listed from newest to oldest within the active freshness window.",
      "",
      `Live site: ${url}`,
      `JSON index: ${url}/api/jobs`,
      "",
      "## Jobs",
      ...jobs.map((job) => {
        const location = job.location ? ` - ${job.location}` : "";
        return `- [${job.title} at ${job.company}](${job.url})${location}`;
      }),
    ];

    return new Response(`${lines.join("\n")}\n`, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400",
      },
    });
  },
);
