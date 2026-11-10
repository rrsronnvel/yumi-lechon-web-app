const MOJIBAKE_REPLACEMENTS: readonly (readonly [RegExp, string])[] = [
  [/\u00f0\u0178\u017d\u0081/g, "🎁"],
  [/\u00f0\u009f\u008e\u0081/g, "🎁"],
  [/\u00e2\u201a\u00b1/g, "₱"],
  [/\u00e2\u20ac\u201c/g, "–"],
  [/\u00e2\u20ac\u201d/g, "—"],
];

/** Repairs known UTF-8/Windows-1252 mojibake at the final display boundary. */
export function sanitizeMojibake(text?: string | null): string {
  if (!text) return "";

  return MOJIBAKE_REPLACEMENTS.reduce(
    (sanitized, [pattern, replacement]) => sanitized.replace(pattern, replacement),
    text,
  );
}
