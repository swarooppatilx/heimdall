"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="text-center">
        <p className="text-6xl font-semibold tracking-tight text-muted-foreground">whoops</p>
        <p className="mt-3 text-sm text-muted-foreground">
          something went wrong while watching the gates. the issue is probably temporary.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button size="sm" onClick={() => reset()}>
            try again
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/">back to fresh jobs</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
