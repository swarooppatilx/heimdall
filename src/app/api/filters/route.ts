import { NextResponse } from "next/server";
import { getFilterOptions } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getFilterOptions());
}
