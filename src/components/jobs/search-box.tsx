import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { MAX_QUERY_LENGTH } from "@/lib/search-params";

interface SearchBoxProps {
  query: string;
  onQueryChange: (value: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}

export function SearchBox({ query, onQueryChange, searchRef }: SearchBoxProps) {
  return (
    // The search box is the one raised surface on the page, so it sits on the
    // card fill and keeps a squarer shape than the pill filters below it.
    <InputGroup className="h-11 rounded-xl bg-card">
      <InputGroupInput
        ref={searchRef}
        type="search"
        enterKeyHint="search"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={MAX_QUERY_LENGTH}
        placeholder="search jobs, companies, skills…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          onQueryChange("");
          e.currentTarget.blur();
        }}
        aria-label="Search jobs"
      />
      <InputGroupAddon align="inline-end" aria-hidden="true" className="hidden md:flex">
        <Kbd>/</Kbd>
      </InputGroupAddon>
    </InputGroup>
  );
}
