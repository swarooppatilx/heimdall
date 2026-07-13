import type { MetadataRoute } from "next";
import { getFilterOptions } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { companies } = await getFilterOptions();
  return [
    {
      url: SITE_URL,
      changeFrequency: "hourly",
      priority: 1,
    },
    ...companies.map((company) => ({
      url: `${SITE_URL}/company/${encodeURIComponent(company)}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
