"use client";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
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
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="text-center">
            <p className="text-6xl font-semibold tracking-tight text-muted-foreground">whoops</p>
            <p className="mt-3 text-sm text-muted-foreground">
              something went wrong at the gate. the issue is probably temporary.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button size="sm" onClick={() => reset()}>
                try again
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="/">back to fresh jobs</a>
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </body>
    </html>
  );
}
