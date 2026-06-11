import { NextResponse } from "next/server";
import { upsertJobs } from "@/lib/db";
import { fetchJobs } from "@/lib/fetch-jobs";
import { getRegistry } from "@/lib/registry";

export const dynamic = "force-dynamic";

export async function POST() {
  const registry = getRegistry();
  const results = await Promise.allSettled(registry.map((entry) => fetchJobs(entry)));

  let total = 0;
  const errors: string[] = [];

  registry.forEach((entry, i) => {
    const result = results[i];
    if (!result) return;

    if (result.status === "fulfilled") {
      upsertJobs(result.value);
      total += result.value.length;
    } else {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      errors.push(`${entry.name}: ${msg}`);
    }
  });

  return NextResponse.json({ synced: total, errors });
}
