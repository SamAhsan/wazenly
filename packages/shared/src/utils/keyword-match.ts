export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Case-fold text for matching. Plain .toLowerCase() alone mishandles Turkish
// "İ" (dotted capital I, U+0130): under the default/root locale it decomposes
// to "i" + a combining dot-above (U+0307) instead of a plain "i", which then
// fails to line up with a keyword written as plain "istemiyorum" etc. Forcing
// the Turkish locale isn't safe either -- it would map ASCII "I" -> "ı"
// (dotless), breaking English matching. Stripping the stray combining mark
// after a normal lowercase gets both cases right without a locale switch.
const COMBINING_DOT_ABOVE = new RegExp("̇", "g");

// Zero-width and bidi-control characters some mobile keyboards insert
// invisibly (zero-width space U+200B, ZWNJ/ZWJ U+200C-200D, left/right-to-
// right marks U+200E-200F, BOM U+FEFF) -- harmless to strip, but left in
// place they can silently break an exact- or word-boundary match against a
// clean keyword string.
const INVISIBLE_CHARS = new RegExp("[​-‏﻿]", "g");

export function foldCase(s: string): string {
  return s.toLowerCase().replace(COMBINING_DOT_ABOVE, "").replace(INVISIBLE_CHARS, "");
}

// Trim + case-fold + drop trailing punctuation, for exact-phrase comparisons
// (e.g. opt-out keyword lists) where a message like "Iptal!" or "İptal."
// should still count as a match for the canonical "iptal".
export function normalizeMessage(text: string): string {
  return foldCase(text.trim()).replace(/[.,!?;:…]+$/g, "").trim();
}

// Whole word/phrase match (word-boundary), not a single-token equality -- so
// multi-word keywords like "not interested" can actually match. Uses Unicode
// letter/number classes rather than the legacy ASCII-only \b, since \b treats
// any non-ASCII letter (Turkish ç, ş, ğ, ı, ö, ü, İ, ...) as a non-word
// character and silently fails to find boundaries around those words. Returns
// the length of the longest matching keyword (useful for specificity/priority
// ranking when several keyword lists could match the same text), or -1 if
// nothing matched.
export function bestKeywordMatchLength(text: string, keywords: string[]): number {
  const lowerText = foldCase(text);
  const lengths = keywords
    .map((k) => foldCase(k).trim())
    .filter(Boolean)
    .filter((k) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(k)}(?![\\p{L}\\p{N}])`, "u").test(lowerText))
    .map((k) => k.length);
  return lengths.length ? Math.max(...lengths) : -1;
}
