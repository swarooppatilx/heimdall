import type { MetadataRoute } from "next";
import { toCompanySlug } from "@/lib/company-slug";
import { getCompanyNames } from "@/lib/db";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = await siteUrl();
  const companies = await getCompanyNames();
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
