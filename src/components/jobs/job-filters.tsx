import { FilterSelect } from "@/components/filter-select";
import type { FacetOptions } from "@/server/jobs/facets";

interface JobFiltersProps {
  query: string;
  setQuery: (value: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  company: string;
  setCompany: (value: string) => void;
  department: string;
  setDepartment: (value: string) => void;
  location: string;
  setLocation: (value: string) => void;
  locationOptions: string[];
  posted: string;
  setPosted: (value: string) => void;
  filterOptions: FacetOptions | undefined;
}

export function JobFilters({
  query,
  setQuery,
  searchRef,
  company,
  setCompany,
  department,
  setDepartment,
  location,
  setLocation,
  locationOptions,
  posted,
  setPosted,
  filterOptions,
}: JobFiltersProps) {
  return (
    <nav aria-label="Search and filters" className="mb-6">
      <div className="relative mb-3">
        <input
          ref={searchRef}
          type="text"
          placeholder="search jobs, companies, skills..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground sm:pr-16 sm:text-base"
          aria-label="Search jobs"
        />
        <kbd className="pointer-events-none absolute top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground md:right-3 md:block">
          /
        </kbd>
      </div>

      <div className="grid grid-cols-2 items-center gap-2 sm:flex">
        <FilterSelect
          value={company}
          onChange={setCompany}
          options={(filterOptions?.companies ?? []).map((o) => o.value)}
          placeholder="company"
          aria-label="Filter by company"
          className="sm:flex-1"
        />
        <FilterSelect
          value={department}
          onChange={setDepartment}
          options={(filterOptions?.departments ?? []).map((o) => o.value)}
          placeholder="role"
          aria-label="Filter by role"
          className="sm:flex-1"
        />
        <FilterSelect
          value={location}
          onChange={setLocation}
          options={locationOptions}
          placeholder="location"
          aria-label="Filter by location"
          className="sm:flex-1"
        />
        <FilterSelect
          value={posted === "week" ? "this week" : posted}
          onChange={(v) => setPosted(v === "this week" ? "week" : v)}
          options={["today", "this week"]}
          placeholder="posted"
          aria-label="Filter by posting date"
          className="sm:flex-1"
        />
      </div>
    </nav>
  );
}
