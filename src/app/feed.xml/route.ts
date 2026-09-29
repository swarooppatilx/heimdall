import { getCloudflareContext } from "@opennextjs/cloudflare";
import { siteConfig } from "@/lib/site";
import { trackApiRequest } from "@/server/analytics";
import { defineRoute } from "@/server/api/define-route";
import { getRecentJobLinksCached, type JobLink } from "@/server/jobs/cached-views";

export const dynamic = "force-dynamic";

const FEED_ITEMS = 100;

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

// Titles and companies come from ATS data, so every text node is escaped.
export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);
}

function item(job: JobLink): string {
  return [
    "    <item>",
    `      <title>${escapeXml(`${job.title} at ${job.company}`)}</title>`,
    `      <link>${escapeXml(job.url)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(job.url)}</guid>`,
    `      <pubDate>${new Date(job.postedAt).toUTCString()}</pubDate>`,
    `      <description>${escapeXml(`${job.company} · ${job.location}`)}</description>`,
    "    </item>",
  ].join("\n");
}

export const GET = defineRoute(
  { binding: "JOBS_RATE_LIMITER", onRequest: trackApiRequest },
  async () => {
    const url = siteConfig.url;
    const { env } = await getCloudflareContext({ async: true });
    const jobs = (await getRecentJobLinksCached(env)).slice(0, FEED_ITEMS);

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      "  <channel>",
      "    <title>heimdall — fresh tech jobs</title>",
      `    <link>${url}/</link>`,
      `    <atom:link href="${url}/feed.xml" rel="self" type="application/rss+xml"/>`,
      "    <description>The newest roles from official company career pages.</description>",
      "    <language>en</language>",
      ...jobs.map(item),
      "  </channel>",
      "</rss>",
    ];

    // Caching is set by the worker's page cache, which tags it for purging.
    return new Response(`${xml.join("\n")}\n`, {
      headers: { "content-type": "application/rss+xml; charset=utf-8" },
    });
  },
);
