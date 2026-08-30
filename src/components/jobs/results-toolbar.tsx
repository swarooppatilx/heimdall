"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreFiltersPopover } from "@/components/jobs/more-filters-popover";
import { SortMenu } from "@/components/jobs/sort-menu";
import type { FacetOptions } from "@/lib/db";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

interface ResultsToolbarProps {
  countLabel: string;
  syncedAt: string | undefined;
  syncStale: boolean;
  hasFilters: boolean;
  advancedCount: number;
  filterOptions: FacetOptions | undefined;
  experience: string;
  onExperienceChange: (value: string) => void;
  source: string;
  onSourceChange: (value: string) => void;
  onClearAll: () => void;
  sort: string;
  onSortChange: (sort: string) => void;
}

export function ResultsToolbar({
  countLabel,
  syncedAt,
  syncStale,
  hasFilters,
  advancedCount,
  filterOptions,
  experience,
  onExperienceChange,
  source,
  onSourceChange,
  onClearAll,
  sort,
  onSortChange,
}: ResultsToolbarProps) {
  return (
    <div className="mb-4 grid gap-y-2 border-b border-border pb-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-x-4">
      <p
        className="flex flex-wrap items-baseline gap-x-3 text-xs text-foreground"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span>{countLabel}</span>
        {syncedAt ? (
          <span
            className={syncStale ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}
          >
            synced {timeAgo(syncedAt)}
          </span>
        ) : null}
      </p>
      <div className="flex items-center justify-between gap-1 sm:justify-self-end">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onClearAll}
            tabIndex={hasFilters ? 0 : -1}
            aria-hidden={!hasFilters}
            className={cn(
              "min-h-9 items-center gap-1 rounded-md border border-ring/40 bg-ring/10 px-2.5 text-xs text-ring transition-colors hover:border-ring/60",
              hasFilters
                ? "inline-flex"
                : "hidden sm:inline-flex sm:invisible sm:pointer-events-none",
            )}
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              strokeWidth={2}
              className="size-3"
              aria-hidden="true"
            />
            clear
          </button>
          <MoreFiltersPopover
            advancedCount={advancedCount}
            filterOptions={filterOptions}
            experience={experience}
            onExperienceChange={onExperienceChange}
            source={source}
            onSourceChange={onSourceChange}
          />
        </div>
        <SortMenu sort={sort} onSortChange={onSortChange} />
      </div>
    </div>
  );
}
