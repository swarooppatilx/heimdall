import { useMemo } from "react";
import type { FacetOptions } from "@/modules/jobs/facets";

export function useLocationOptions(filterOptions: FacetOptions | undefined): string[] {
  return useMemo(() => {
    if (!filterOptions) return ["remote"];
    const countries = [...filterOptions.countries].sort((a, b) => b.count - a.count);
    const cities = countries
      .flatMap((c) => c.cities.map((t) => ({ value: `${t.value}, ${c.value}`, count: t.count })))
      .sort((a, b) => b.count - a.count);
    return ["remote", ...countries.map((c) => c.value), ...cities.map((t) => t.value)];
  }, [filterOptions]);
}
