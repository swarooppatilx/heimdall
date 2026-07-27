"use client";

import { MoreFiltersPopover } from "@/components/jobs/more-filters-popover";
import { SortMenu } from "@/components/jobs/sort-menu";
import type { FacetOptions } from "@/lib/db";
import { timeAgo } from "@/lib/time-ago";

interface ResultsToolbarProps {
  countLabel: string;
  syncedAt: string | undefined;
  syncStale: boolean;
  advancedCount: number;
  filterOptions: FacetOptions | undefined;
  experience: string;
  onExperienceChange: (value: string) => void;
  source: string;
  onSourceChange: (value: string) => void;
  employmentType: string;
  onEmploymentTypeChange: (value: string) => void;
  onClearAll: () => void;
  sort: string;
  onSortChange: (sort: string) => void;
}

export function ResultsToolbar({
  countLabel,
  syncedAt,
  syncStale,
  advancedCount,
  filterOptions,
  experience,
  onExperienceChange,
  source,
  onSourceChange,
  employmentType,
  onEmploymentTypeChange,
  onClearAll,
  sort,
  onSortChange,
}: ResultsToolbarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border pb-3">
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
      <div className="flex items-center gap-1">
        <MoreFiltersPopover
          advancedCount={advancedCount}
          filterOptions={filterOptions}
          experience={experience}
          onExperienceChange={onExperienceChange}
          source={source}
          onSourceChange={onSourceChange}
          employmentType={employmentType}
          onEmploymentTypeChange={onEmploymentTypeChange}
          onClearAll={onClearAll}
        />
        <SortMenu sort={sort} onSortChange={onSortChange} />
      </div>
    </div>
  );
}
