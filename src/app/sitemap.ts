import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { MetadataRoute } from "next";
import { toCompanySlug } from "@/modules/companies/slug";
import { getCompanyNamesFromKV } from "@/server/jobs/kv";
import { getCompanyNames } from "@/server/jobs/queries";
import { siteUrl } from "@/server/jobs/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = await siteUrl();
  const { env } = await getCloudflareContext();
  const kvNames = await getCompanyNamesFromKV(env);
  const companies = kvNames ?? (await getCompanyNames());
  return [
    {
      url,
      changeFrequency: "hourly",
      priority: 1,
    },
    ...companies.map((company) => ({
      url: `${url}/company/${toCompanySlug(company)}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
