import { headers } from "next/headers";

export async function siteUrl(): Promise<string> {
  const host = (await headers()).get("host");
  if (host) return `https://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://heimdall.daenerys.workers.dev";
}
