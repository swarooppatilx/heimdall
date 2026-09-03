import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { toCompanySlug } from "@/modules/companies/slug";
import { getCompanyNamesFromKV } from "@/modules/jobs/kv";
import { getCompanyNames } from "@/modules/jobs/queries";

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
