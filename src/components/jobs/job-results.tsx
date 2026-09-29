"use client";

import type { RefObject } from "react";
import { JobCard } from "@/components/jobs/job-card";
import { JobCardSkeleton } from "@/components/jobs/job-card-skeleton";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import type { DedupedJob, JobDto } from "@/lib/job";
import { cn } from "@/lib/utils";

// Varied title widths so a column of placeholders reads as a list, not a grid.
const INITIAL_SKELETON_WIDTHS = [
  "w-2/3",
  "w-1/2",
  "w-3/4",
  "w-2/5",
  "w-3/5",
  "w-5/6",
  "w-1/3",
  "w-4/5",
];
const NEXT_PAGE_SKELETON_WIDTHS = ["w-7/12", "w-5/12"];

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>couldn't load jobs</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={onRetry}>
          try again
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  if (!hasFilters) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>no fresh jobs right now</EmptyTitle>
          <EmptyDescription>check back in a bit.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>nothing matches these filters</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={onClear}>
          clear filters
        </Button>
      </EmptyContent>
    </Empty>
  );
}

interface JobResultsProps {
  jobCards: DedupedJob<JobDto>[];
  isLoading: boolean;
  isUpdating: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  loadMoreFailed: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  hasFilters: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
  onClear: () => void;
}

export function JobResults({
  jobCards,
  isLoading,
  isUpdating,
  isError,
  isFetchingNextPage,
  hasNextPage,
  loadMoreFailed,
  sentinelRef,
  hasFilters,
  onRetry,
  onLoadMore,
  onClear,
}: JobResultsProps) {
  const isEmpty = !(isError || isLoading) && jobCards.length === 0;
  const isEnd = !(isError || isLoading || hasNextPage) && jobCards.length > 0;

  return (
    <>
      {isError ? <ErrorState onRetry={onRetry} /> : null}
      {isEmpty ? <EmptyState hasFilters={hasFilters} onClear={onClear} /> : null}

      {/* biome-ignore lint/correctness/useUniqueElementIds: stable anchor target for the skip link */}
      <ul
        id="job-results"
        tabIndex={-1}
        aria-busy={isUpdating}
        // Dims only if the new results take a moment, so fast responses don't flicker.
        className={cn(
          "flex flex-col gap-2 transition-opacity",
          isUpdating && "opacity-60 delay-150",
        )}
      >
        {isLoading
          ? INITIAL_SKELETON_WIDTHS.map((width) => (
              <JobCardSkeleton key={width} titleWidth={width} />
            ))
          : jobCards.map(({ job, openings }) => (
              <JobCard key={job.id} job={job} openings={openings} />
            ))}
        {isFetchingNextPage
          ? NEXT_PAGE_SKELETON_WIDTHS.map((width) => (
              <JobCardSkeleton key={width} titleWidth={width} />
            ))
          : null}
      </ul>

      {hasNextPage ? <div ref={sentinelRef} aria-hidden="true" className="h-1" /> : null}
      {loadMoreFailed ? (
        <div className="flex items-center justify-center gap-3 pt-6 text-xs text-muted-foreground">
          couldn't load more
          <Button variant="outline" size="sm" onClick={onLoadMore}>
            try again
          </Button>
        </div>
      ) : null}
      {isEnd ? (
        <p className="pt-6 text-center text-xs text-muted-foreground">that's everything.</p>
      ) : null}
    </>
  );
}
