"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SortMenu } from "@/components/jobs/sort-menu";
import { Button } from "@/components/ui/button";
import { type HomeFilterKey, type HomeFilters, hasActiveFilters } from "@/lib/search-params";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

interface SyncState {
  syncedAt: string | undefined;
  syncStale: boolean;
}

interface ResultsToolbarProps {
  countLabel: string;
  isUpdating: boolean;
  sync: SyncState;
  filters: HomeFilters;
  onFilterChange: (key: HomeFilterKey, value: string) => void;
  onClear: () => void;
}

export function ResultsToolbar({
  countLabel,
  isUpdating,
  sync,
  filters,
  onFilterChange,
  onClear,
}: ResultsToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <ResultsSummary
          countLabel={countLabel}
          isUpdating={isUpdating}
          sync={sync}
          className="hidden sm:flex"
        />
      </div>
      <div className="flex items-center gap-2">
        {hasActiveFilters(filters) ? (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} data-icon="inline-start" />
            clear
          </Button>
        ) : null}
        <SortMenu
          sort={filters.sort}
          searching={filters.q !== ""}
          onSortChange={(value) => onFilterChange("sort", value)}
        />
      </div>
    </div>
  );
}

interface ResultsSummaryProps {
  countLabel: string;
  isUpdating: boolean;
  sync: SyncState;
  className?: string;
}

export function ResultsSummary({ countLabel, isUpdating, sync, className }: ResultsSummaryProps) {
  if (!countLabel) return null;
  const syncedAgo = sync.syncedAt ? timeAgo(sync.syncedAt) : undefined;

  return (
    <p
      aria-busy={isUpdating}
      className={cn(
        "flex items-baseline gap-x-1.5 text-xs text-muted-foreground transition-opacity",
        isUpdating && "opacity-60 delay-150",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="font-medium text-foreground">{countLabel}</span>
      {syncedAgo ? (
        <>
          <span aria-hidden="true">·</span>
          <span className={sync.syncStale ? "text-warning" : undefined}>
            updated {syncedAgo === "now" ? "just now" : `${syncedAgo} ago`}
          </span>
        </>
      ) : null}
    </p>
  );
}
