export function JobCardSkeleton() {
  return (
    <li className="rounded-lg border border-border/60 p-3 sm:p-4" aria-hidden="true">
      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-3 w-1/4 animate-pulse rounded bg-muted" />
    </li>
  );
}
