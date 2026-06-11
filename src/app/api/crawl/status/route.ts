import { NextResponse } from "next/server";
import { getCrawlHistory, getLatestCrawls } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  const latest = getLatestCrawls();
  const history = getCrawlHistory();
  return NextResponse.json({ latest, history });
}
