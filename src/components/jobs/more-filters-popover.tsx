"use client";

import { useId } from "react";
import { FilterSelect } from "@/components/filter-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FacetOptions } from "@/lib/db";

interface MoreFiltersPopoverProps {
  advancedCount: number;
  filterOptions: FacetOptions | undefined;
  experience: string;
  onExperienceChange: (value: string) => void;
  source: string;
  onSourceChange: (value: string) => void;
}

export function MoreFiltersPopover({
  advancedCount,
  filterOptions,
  experience,
  onExperienceChange,
  source,
  onSourceChange,
}: MoreFiltersPopoverProps) {
  const experienceId = useId();
  const sourceId = useId();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          suppressHydrationWarning
          className={`min-h-9 rounded-md border px-2.5 text-xs transition-colors ${
            advancedCount > 0
              ? "border-ring/40 bg-ring/10 text-ring"
              : "border-dashed border-border text-muted-foreground hover:border-ring/50 hover:text-foreground"
          }`}
        >
          {advancedCount > 0 ? `more filters · ${advancedCount}` : "+ more filters"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 max-w-[calc(100vw-2rem)] p-4">
        <div className="space-y-4">
          <div>
            <label
              htmlFor={experienceId}
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              seniority
            </label>
            <FilterSelect
              id={experienceId}
              value={experience}
              onChange={onExperienceChange}
              options={["intern", "entry", "mid", "senior", "staff"]}
              placeholder="any level"
              aria-label="Filter by seniority"
            />
          </div>
          <div>
            <label
              htmlFor={sourceId}
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              source
            </label>
            <FilterSelect
              id={sourceId}
              value={source}
              onChange={onSourceChange}
              options={(filterOptions?.sources ?? []).map((o) => o.value)}
              placeholder="any source"
              aria-label="Filter by source"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
