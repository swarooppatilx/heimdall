import { headers } from "next/headers";

export async function siteUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl;
  const host = (await headers()).get("host");
  if (host) return `https://${host}`;
  return "https://heimdall.daenerys.workers.dev";
}
