"use client";

interface ActiveFilterChipsProps {
  hasFilters: boolean;
  onClearAll: () => void;
}

export function ActiveFilterChips({ hasFilters, onClearAll }: ActiveFilterChipsProps) {
  if (!hasFilters) return null;
  return (
    <div className="mb-3 flex justify-end">
      <button
        type="button"
        onClick={onClearAll}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
      >
        clear filters
      </button>
    </div>
  );
}
