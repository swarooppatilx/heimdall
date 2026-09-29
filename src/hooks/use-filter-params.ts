"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  clearedFilters,
  type HomeFilterKey,
  type HomeFilters,
  parseHomeFilters,
  toQueryString,
} from "@/lib/search-params";

const SEARCH_DEBOUNCE_MS = 300;

// Filters live in the URL so every search is shareable. The search box is
// tracked separately and only reaches `filters.q` once typing pauses.
export function useFilterParams(initial: HomeFilters) {
  const router = useRouter();
  const [filters, setFilters] = useState(initial);
  const [query, setQuery] = useState(initial.q);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    setFilters((current) =>
      current.q === debouncedQuery ? current : { ...current, q: debouncedQuery },
    );
  }, [debouncedQuery]);

  useEffect(() => {
    const next = toQueryString(filters);
    const current = toQueryString(parseHomeFilters(new URLSearchParams(window.location.search)));
    if (next !== current) router.replace(`/${next}`, { scroll: false });
  }, [filters, router]);

  useEffect(() => {
    function syncFromUrl() {
      const fromUrl = parseHomeFilters(new URLSearchParams(window.location.search));
      setFilters(fromUrl);
      setQuery(fromUrl.q);
    }
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const setFilter = useCallback((key: HomeFilterKey, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setQuery("");
    setFilters(clearedFilters);
  }, []);

  return { filters, setFilter, clearFilters, query, setQuery };
}
