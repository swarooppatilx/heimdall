import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const url = await siteUrl();
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${url}/sitemap.xml`,
  };
}
