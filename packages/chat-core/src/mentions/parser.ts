/**
 * Mention token parser.
 *
 * Token grammar:
 *   @[kind:id]                — minimal form; displayText defaults to id
 *   @[kind:id|displayText]    — full form
 *
 *   kind         : [A-Za-z0-9-]+
 *   id           : [^\]|]+
 *   displayText  : [^\]]*     (may be empty; defaults to id when omitted)
 *
 * Anything not matching the grammar is preserved verbatim as text segments.
 * Malformed tokens (unterminated, illegal characters) are NOT parsed — they
 * pass through as plain text so the user always sees what they typed.
 */

import type { MentionRef, ParsedSegment } from './types.js';

const TOKEN_RE = /@\[([A-Za-z0-9-]+):([^\]|]+)(?:\|([^\]]*))?\]/g;

/**
 * Parse a string of message text into an ordered array of text and mention
 * segments. Always returns at least one segment for non-empty input. For an
 * empty string, returns an empty array.
 *
 * The parser is intentionally permissive in `TKind` — it returns mentions
 * with `kind` typed as `TKind`, but does NOT validate that the parsed kind
 * is a member of the consumer's union. Validation, if needed, is the
 * consumer's job; the wire token is the source of truth.
 */
export function parseMentionTokens<TKind extends string = string>(
  text: string,
): Array<ParsedSegment<TKind>> {
  if (text.length === 0) return [];

  const segments: Array<ParsedSegment<TKind>> = [];
  let lastIndex = 0;

  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(text)) !== null) {
    const [whole, kindRaw, idRaw, displayRaw] = match;
    const start = match.index;
    const end = start + whole.length;

    if (start > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, start) });
    }

    const ref: MentionRef<TKind> = {
      kind: kindRaw as TKind,
      id: idRaw,
      displayText: displayRaw && displayRaw.length > 0 ? displayRaw : idRaw,
    };
    segments.push({ type: 'mention', ref });

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return segments;
}

/**
 * Build a wire token from a MentionRef. Inverse of the parser's per-token
 * branch — same grammar.
 */
export function formatMentionToken<TKind extends string>(ref: MentionRef<TKind>): string {
  return `@[${ref.kind}:${ref.id}|${ref.displayText}]`;
}
