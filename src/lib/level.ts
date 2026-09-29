// Five buckets because titles only say reliably whether a role is an
// internship, early career, senior, or beyond; finer ladders (staff vs
// principal, vp vs c-suite) were mostly guesses that split the filter into
// near-empty options.
export const LEVELS = ["intern", "entry", "mid", "senior", "lead"] as const;

export type Level = (typeof LEVELS)[number];
