"use client";

import Link from "next/link";
import { StatusPage } from "@/components/layout/status-page";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <StatusPage code="500" message="something broke at the gate. it's usually temporary.">
      <Button onClick={() => reset()}>try again</Button>
      <Button asChild variant="outline">
        <Link href="/">back to fresh jobs</Link>
      </Button>
    </StatusPage>
  );
}
