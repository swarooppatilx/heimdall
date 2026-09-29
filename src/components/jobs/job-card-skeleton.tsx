import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Rows are sized to the card's line heights so swapping in real cards
// doesn't shift the page.
export function JobCardSkeleton({ titleWidth }: { titleWidth: string }) {
  return (
    <li className="rounded-lg border border-border p-3 sm:p-4" aria-hidden="true">
      <div className="flex h-5 items-center justify-between gap-3 sm:h-6">
        <Skeleton className={cn("h-3.5 sm:h-4", titleWidth)} />
        <Skeleton className="h-3 w-6" />
      </div>
      <div className="mt-1 flex h-4 items-center">
        <Skeleton className="h-3 w-2/5" />
      </div>
    </li>
  );
}
