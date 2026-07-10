export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole word/phrase match (word-boundary), not a single-token equality -- so
// multi-word keywords like "not interested" can actually match. Returns the
// length of the longest matching keyword (useful for specificity/priority
// ranking when several keyword lists could match the same text), or -1 if
// nothing matched.
export function bestKeywordMatchLength(text: string, keywords: string[]): number {
  const lowerText = text.toLowerCase();
  const lengths = keywords
    .map((k) => k.toLowerCase().trim())
    .filter(Boolean)
    .filter((k) => new RegExp(`\\b${escapeRegex(k)}\\b`).test(lowerText))
    .map((k) => k.length);
  return lengths.length ? Math.max(...lengths) : -1;
}
