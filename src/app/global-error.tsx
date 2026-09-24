"use client";

import { Footer } from "@/components/layout/footer";
import { StatusPage } from "@/components/layout/status-page";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        <StatusPage code="500" message="something broke at the gate. it's usually temporary.">
          <Button onClick={() => reset()}>try again</Button>
          <Button asChild variant="outline">
            <a href="/">back to fresh jobs</a>
          </Button>
        </StatusPage>
        <Footer />
      </body>
    </html>
  );
}
