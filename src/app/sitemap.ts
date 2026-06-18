import type { MetadataRoute } from "next";
import { getRegistry } from "@/lib/registry";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "hourly",
      priority: 1,
    },
    ...getRegistry().map((entry) => ({
      url: `${SITE_URL}/company/${entry.name}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
