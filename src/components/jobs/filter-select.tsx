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
  label?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  label,
  className,
  id,
  "aria-label": ariaLabel,
}: FilterSelectProps) {
  return (
    <Combobox value={value || null} onValueChange={(v) => onChange(v ?? "")} items={options}>
      <ComboboxInput
        placeholder={placeholder}
        label={label ?? placeholder}
        showClear
        className={className}
        id={id}
        title={value || undefined}
        aria-label={ariaLabel}
      />
      <ComboboxContent>
        <ComboboxEmpty>no results</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              <span className="truncate">{item}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
