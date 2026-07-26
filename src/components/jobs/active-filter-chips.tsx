"use client";

interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface ActiveFilterChipsProps {
  chips: Chip[];
  onClearAll: () => void;
}

export function ActiveFilterChips({ chips, onClearAll }: ActiveFilterChipsProps) {
  if (chips.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className="group inline-flex min-h-9 items-center gap-1.5 rounded-full border border-ring/30 bg-ring/10 px-3 text-xs text-ring transition-colors hover:border-ring/60"
          aria-label={`Remove filter ${chip.label}`}
        >
          {chip.label}
          <span aria-hidden="true" className="text-muted-foreground group-hover:text-foreground">
            ✕
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="min-h-9 px-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        clear all
      </button>
    </div>
  );
}
