/**
 * Extracts hashtags from post content for client-side display purposes.
 * Server-side extraction is authoritative for storage.
 */
export function extractHashtags(content: string): string[] {
  const matches = content.match(/#[\p{L}\p{N}_]+/gu);
  return matches ? [...new Set(matches.map((t) => t.toLowerCase()))] : [];
}

/**
 * Renders post content with hashtags wrapped in clickable spans.
 * Returns an array of text segments and hashtag tokens.
 */
export function tokenizeContent(content: string): Array<{ type: "text" | "hashtag"; value: string }> {
  const parts = content.split(/(#[\p{L}\p{N}_]+)/gu);
  return parts
    .filter((p) => p.length > 0)
    .map((part) => ({
      type: /^#[\p{L}\p{N}_]+$/u.test(part) ? "hashtag" : "text",
      value: part,
    }));
}
