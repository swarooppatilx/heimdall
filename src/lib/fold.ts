// Letters NFKD doesn't decompose into a base letter plus a mark.
const LIGATURES: Record<string, string> = {
  ß: "ss",
  ø: "o",
  æ: "ae",
  œ: "oe",
  đ: "d",
  ł: "l",
  ı: "i",
};

/**
 * Comparison key for human text: lowercased, accents stripped, ligatures
 * spelled out, so "München", "MUNCHEN" and "munchen" compare equal. Use it
 * wherever two spellings of the same name must match; never for display.
 */
export function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[ßøæœđłı]/g, (char) => LIGATURES[char] ?? char);
}
