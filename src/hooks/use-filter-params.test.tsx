// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFilterParams } from "@/hooks/use-filter-params";
import { EMPTY_HOME_FILTERS } from "@/lib/search-params";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

beforeEach(() => {
  vi.useFakeTimers();
  replace.mockClear();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useFilterParams", () => {
  it("writes a changed filter to the URL without scrolling", () => {
    const { result } = renderHook(() => useFilterParams(EMPTY_HOME_FILTERS));

    act(() => result.current.setFilter("company", "stripe"));

    expect(result.current.filters.company).toBe("stripe");
    expect(replace).toHaveBeenCalledWith("/?company=stripe", { scroll: false });
  });

  it("applies the search box only after typing pauses", () => {
    const { result } = renderHook(() => useFilterParams(EMPTY_HOME_FILTERS));

    act(() => result.current.setQuery("rust"));
    expect(result.current.filters.q).toBe("");

    act(() => vi.advanceTimersByTime(300));
    expect(result.current.filters.q).toBe("rust");
  });

  it("clears every filter and the search box but keeps the sort", () => {
    const initial = { ...EMPTY_HOME_FILTERS, q: "go", company: "stripe", sort: "company" };
    const { result } = renderHook(() => useFilterParams(initial));

    act(() => result.current.clearFilters());

    expect(result.current.query).toBe("");
    expect(result.current.filters).toEqual({ ...EMPTY_HOME_FILTERS, sort: "company" });
  });

  it("follows the URL on back and forward", () => {
    const { result } = renderHook(() => useFilterParams(EMPTY_HOME_FILTERS));

    act(() => {
      window.history.replaceState(null, "", "/?location=berlin&q=data");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(result.current.filters.location).toBe("berlin");
    expect(result.current.query).toBe("data");
  });
});
