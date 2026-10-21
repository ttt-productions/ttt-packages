// Vitest can finish a run with no failing test and still exit non-zero: an error thrown outside a
// test's own await chain (an async `onError`, a floating promise, a timer callback) is reported as
// an UNHANDLED error, which the JSON reporter records against no test. Vitest prints its diagnosis
// — the cause, the stack, the originating test file — to its output, and a truncated tail hides
// it, so the quiet gate extracts the block whole.

const BLOCK_START = /Unhandled\s+(?:Error|Rejection|Errors)|Vitest caught \d+ error/i;
const BLOCK_END = /This error originated in .*test file/i;
const ERRORS_SUMMARY = /^\s*Errors\s+\d+\s+errors?\b/i;

/**
 * Every unhandled-error block and every `Errors N errors` summary line in a Vitest output blob. A
 * block runs from its opening marker through the "This error originated in … test file" line; an
 * unterminated final block runs to the end, so a truncated stream still yields its diagnosis.
 */
export function extractUnhandledErrorReport(text: string | null | undefined): {
  blocks: string[];
  summary: string[];
} {
  const lines = String(text ?? '').split(/\r?\n/);
  const blocks: string[] = [];
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (start === -1) {
      if (BLOCK_START.test(lines[i]!)) start = i;
      continue;
    }
    if (BLOCK_END.test(lines[i]!)) {
      blocks.push(
        lines
          .slice(start, i + 1)
          .join('\n')
          .trim(),
      );
      start = -1;
    }
  }
  if (start !== -1) blocks.push(lines.slice(start).join('\n').trim());
  const summary = lines.filter((l) => ERRORS_SUMMARY.test(l)).map((l) => l.trim());
  return { blocks: blocks.filter(Boolean), summary };
}

/** The extracted diagnosis as the gate prints it, or null when the blob carries none. */
export function formatUnhandledErrorReport(text: string | null | undefined): string | null {
  const { blocks, summary } = extractUnhandledErrorReport(text);
  if (blocks.length === 0 && summary.length === 0) return null;
  const parts: string[] = [];
  if (blocks.length > 0) {
    parts.push(
      `Vitest reported ${blocks.length} unhandled error block${blocks.length === 1 ? '' : 's'} ` +
        '(thrown outside a test’s own await chain — no test FAILS, the run does):',
    );
    parts.push(...blocks);
  }
  if (summary.length > 0) parts.push(summary.join('\n'));
  return parts.join('\n\n');
}
