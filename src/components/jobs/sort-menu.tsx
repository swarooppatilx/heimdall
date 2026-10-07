"use client";

import { ArrowUpDownIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { refocusWithoutScroll } from "@/lib/utils";

const SORT_LABELS = {
  relevance: "best match",
  newest: "newest first",
  company: "company a–z",
} as const;

type SortKey = keyof typeof SORT_LABELS;

interface SortMenuProps {
  sort: string;
  searching: boolean;
  onSortChange: (sort: string) => void;
}

// The default sort is never written to the URL: best match while searching,
// newest otherwise, so a search link stays ranked without a sort param.
export function SortMenu({ sort, searching, onSortChange }: SortMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fallback: SortKey = searching ? "relevance" : "newest";
  const current: SortKey = sort === "newest" || sort === "company" ? sort : fallback;
  const label = SORT_LABELS[current];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          variant="ghost"
          size="sm"
          aria-label={`Sort: ${label}`}
          suppressHydrationWarning
        >
          <HugeiconsIcon icon={ArrowUpDownIcon} strokeWidth={2} data-icon="inline-start" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-40"
        onCloseAutoFocus={refocusWithoutScroll(triggerRef)}
      >
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(v) => onSortChange(v === fallback ? "" : v)}
        >
          {searching ? (
            <DropdownMenuRadioItem value="relevance">{SORT_LABELS.relevance}</DropdownMenuRadioItem>
          ) : null}
          <DropdownMenuRadioItem value="newest">{SORT_LABELS.newest}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="company">{SORT_LABELS.company}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
