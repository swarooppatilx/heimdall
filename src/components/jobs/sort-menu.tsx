"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
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
        >
          sort · {sort === "company" ? "company a–z" : "newest first"}
          <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          value={sort || "newest"}
          onValueChange={(v) => onSortChange(v === "newest" ? "" : v)}
        >
          <DropdownMenuRadioItem value="newest">newest first</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="company">company a–z</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
