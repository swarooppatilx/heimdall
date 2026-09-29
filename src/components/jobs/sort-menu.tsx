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
  newest: "newest first",
  company: "company a–z",
} as const;

interface SortMenuProps {
  sort: string;
  onSortChange: (sort: string) => void;
}

export function SortMenu({ sort, onSortChange }: SortMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = sort === "company" ? SORT_LABELS.company : SORT_LABELS.newest;

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
          value={sort || "newest"}
          onValueChange={(v) => onSortChange(v === "newest" ? "" : v)}
        >
          <DropdownMenuRadioItem value="newest">{SORT_LABELS.newest}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="company">{SORT_LABELS.company}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
