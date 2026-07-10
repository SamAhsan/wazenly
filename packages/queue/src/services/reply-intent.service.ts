import { INTERESTED_KEYWORDS, NOT_INTERESTED_KEYWORDS, bestKeywordMatchLength } from "@wazenly/shared";

export function classifyReplyIntent(text: string): "INTERESTED" | "NOT_INTERESTED" | null {
  const interested = bestKeywordMatchLength(text, INTERESTED_KEYWORDS);
  const notInterested = bestKeywordMatchLength(text, NOT_INTERESTED_KEYWORDS);

  if (interested < 0 && notInterested < 0) return null;
  return notInterested >= interested ? "NOT_INTERESTED" : "INTERESTED";
}
