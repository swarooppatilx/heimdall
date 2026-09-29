import { getCloudflareContext } from "@opennextjs/cloudflare";
import { siteConfig } from "@/lib/site";
import { trackApiRequest } from "@/server/analytics";
import { defineRoute } from "@/server/api/define-route";
import { getRecentJobLinksCached } from "@/server/jobs/cached-views";

export const dynamic = "force-dynamic";

export const GET = defineRoute(
  { binding: "JOBS_RATE_LIMITER", onRequest: trackApiRequest },
  async () => {
    const url = siteConfig.url;
    const { env } = await getCloudflareContext();
    const jobs = await getRecentJobLinksCached(env);

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

    // Caching is set by the worker's page cache, which tags it for purging.
    return new Response(`${lines.join("\n")}\n`, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
);
