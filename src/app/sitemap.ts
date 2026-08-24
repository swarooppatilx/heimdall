import type { MetadataRoute } from "next";
import { toCompanySlug } from "@/lib/company-slug";
import { getCompanyNames } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const companies = await getCompanyNames();
  return [
    {
      url: SITE_URL,
      changeFrequency: "hourly",
      priority: 1,
    },
    ...companies.map((company) => ({
      url: `${SITE_URL}/company/${toCompanySlug(company)}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
