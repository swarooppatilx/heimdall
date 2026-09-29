import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { MetadataRoute } from "next";
import { toCompanySlug } from "@/lib/company-slug";
import { siteConfig } from "@/lib/site";
import { getCompanyIndexCached } from "@/server/jobs/cached-views";

// Company pages come and go with each crawl, so the sitemap is built per request.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = siteConfig.url;
  const { env } = await getCloudflareContext({ async: true });
  const companies = await getCompanyIndexCached(env);
  // ISO strings sort chronologically, so the newest posting is the max.
  const newest = companies.reduce<string | undefined>(
    (latest, { lastPostedAt }) => (!latest || lastPostedAt > latest ? lastPostedAt : latest),
    undefined,
  );
  return [
    {
      url,
      ...(newest ? { lastModified: new Date(newest) } : {}),
      changeFrequency: "hourly",
      priority: 1,
    },
    ...companies.map(({ name, lastPostedAt }) => ({
      url: `${url}/company/${toCompanySlug(name)}`,
      lastModified: new Date(lastPostedAt),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
