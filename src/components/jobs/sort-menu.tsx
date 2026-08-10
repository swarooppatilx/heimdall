"use client";

import { ArrowUpDownIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SortMenuProps {
  sort: string;
  onSortChange: (sort: string) => void;
}

export function SortMenu({ sort, onSortChange }: SortMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Sort jobs"
          suppressHydrationWarning
        >
          <HugeiconsIcon icon={ArrowUpDownIcon} strokeWidth={2} className="size-3.5" />
          {sort === "company" ? "alphabetical" : "newest"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-28">
        <DropdownMenuRadioGroup
          value={sort || "newest"}
          onValueChange={(v) => onSortChange(v === "newest" ? "" : v)}
        >
          <DropdownMenuRadioItem value="newest">newest</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="company">alphabetical</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
