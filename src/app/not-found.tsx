import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="text-center">
        <p className="text-6xl font-semibold tracking-tight text-muted-foreground">404</p>
        <p className="mt-3 text-sm text-muted-foreground">
          nothing to watch here. the page moved or the listing expired.
        </p>
        <Button asChild size="sm" className="mt-6">
          <Link href="/">back to fresh jobs</Link>
        </Button>
      </div>
    </main>
  );
}
