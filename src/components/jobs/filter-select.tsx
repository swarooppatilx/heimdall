"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  id,
  "aria-label": ariaLabel,
}: FilterSelectProps) {
  return (
    <Combobox value={value || null} onValueChange={(v) => onChange(v ?? "")} items={options}>
      <ComboboxInput
        placeholder={placeholder}
        showClear
        className={className}
        id={id}
        aria-label={ariaLabel}
      />
      <ComboboxContent className="min-w-0">
        <ComboboxEmpty>no results</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
