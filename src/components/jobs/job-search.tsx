"use client";

import { JobFilters } from "@/components/jobs/job-filters";
import { JobResults } from "@/components/jobs/job-results";
import { ResultsSummary, ResultsToolbar } from "@/components/jobs/results-toolbar";
import { SearchBox } from "@/components/jobs/search-box";
import { Header } from "@/components/layout/header";
import { SkipLink } from "@/components/layout/skip-link";
import { type HomeInitialData, useJobSearch } from "@/hooks/use-job-search";
import { hasActiveFilters } from "@/lib/search-params";

export function JobSearch({ initial }: { initial: HomeInitialData }) {
  const search = useJobSearch(initial);

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink href="#job-results" />
      <Header />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-8 sm:px-6">
        <SearchBox
          query={search.query}
          onQueryChange={search.setQuery}
          searchRef={search.searchRef}
        />

        {/* Sticky so sort and filters stay reachable deep into the list. */}
        <div className="sticky top-header z-10 -mx-4 mt-3 flex flex-col gap-3 bg-background/85 px-4 py-3 backdrop-blur-md after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-border sm:-mx-6 sm:px-6 sm:after:inset-x-6">
          <JobFilters
            filters={search.filters}
            onFilterChange={search.setFilter}
            facets={search.facets}
            locationOptions={search.locationOptions}
          />
          <ResultsToolbar
            countLabel={search.countLabel}
            isUpdating={search.isUpdating}
            sync={search.sync}
            filters={search.filters}
            onFilterChange={search.setFilter}
            onClear={search.clearFilters}
          />
        </div>

        <ResultsSummary
          countLabel={search.countLabel}
          isUpdating={search.isUpdating}
          sync={search.sync}
          className="mt-3 sm:hidden"
        />

        <div className="mt-3 sm:mt-4">
          <JobResults
            {...search.results}
            hasFilters={hasActiveFilters(search.filters)}
            onClear={search.clearFilters}
          />
        </div>
      </main>
    </div>
  );
}
