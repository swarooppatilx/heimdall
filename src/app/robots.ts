import type { MetadataRoute } from "next";
import { siteUrl } from "@/modules/jobs/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const url = await siteUrl();
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${url}/sitemap.xml`,
  };
}
