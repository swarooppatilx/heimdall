import { useEffect } from "react";

const EDITABLE_TARGETS = "input, textarea, select, [contenteditable='true'], [role='dialog']";

type ShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "target" | "metaKey" | "ctrlKey" | "altKey" | "isComposing"
>;

// Leaves browser and OS chords like Ctrl+/ alone, and never steals a "/"
// typed into a field or mid-IME composition.
export function isSearchShortcut(e: ShortcutEvent): boolean {
  if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return false;
  const target = e.target as Element | null;
  return !target?.closest(EDITABLE_TARGETS);
}

export function useSearchShortcut(searchRef: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!isSearchShortcut(e)) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [searchRef]);
}
