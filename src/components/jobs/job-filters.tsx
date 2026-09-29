import { FilterSelect } from "@/components/jobs/filter-select";
import type { FacetOptions } from "@/lib/api-types";
import { LEVELS } from "@/lib/level";
import type { HomeFilterKey, HomeFilters } from "@/lib/search-params";

interface JobFiltersProps {
  filters: HomeFilters;
  onFilterChange: (key: HomeFilterKey, value: string) => void;
  facets: FacetOptions | undefined;
  locationOptions: string[];
}

export function JobFilters({ filters, onFilterChange, facets, locationOptions }: JobFiltersProps) {
  return (
    <nav aria-label="Filters" className="grid grid-cols-2 gap-2 md:flex">
      <FilterSelect
        value={filters.company}
        onChange={(value) => onFilterChange("company", value)}
        options={(facets?.companies ?? []).map((o) => o.value)}
        placeholder="company"
        aria-label="Filter by company"
        className="md:flex-1"
      />
      <FilterSelect
        value={filters.department}
        onChange={(value) => onFilterChange("department", value)}
        options={(facets?.departments ?? []).map((o) => o.value)}
        placeholder="role"
        aria-label="Filter by role"
        className="md:flex-1"
      />
      <FilterSelect
        value={filters.location}
        onChange={(value) => onFilterChange("location", value)}
        options={locationOptions}
        placeholder="location"
        aria-label="Filter by location"
        className="md:flex-1"
      />
      <FilterSelect
        value={filters.level}
        onChange={(value) => onFilterChange("level", value)}
        options={[...LEVELS]}
        placeholder="level"
        aria-label="Filter by level"
        className="md:flex-1"
      />
    </nav>
  );
}
