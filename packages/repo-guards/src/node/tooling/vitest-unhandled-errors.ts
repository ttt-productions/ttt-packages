// Vitest can exit non-zero with no failing test: an unhandled error is recorded against no test,
// and only its printed output carries the diagnosis.

const BLOCK_START = /Unhandled\s+(?:Error|Rejection|Errors)|Vitest caught \d+ error/i;
const BLOCK_END = /This error originated in .*test file/i;
const ERRORS_SUMMARY = /^\s*Errors\s+\d+\s+errors?\b/i;

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
