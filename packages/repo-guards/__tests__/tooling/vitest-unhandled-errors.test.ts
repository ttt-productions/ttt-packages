import { describe, it, expect } from 'vitest';
import {
  extractUnhandledErrorReport,
  formatUnhandledErrorReport,
} from '../../src/node/tooling/vitest-unhandled-errors.js';

const STDERR = [
  '',
  '⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯',
  '',
  'Vitest caught 3 errors during the test run.',
  'This might cause false positive tests. Resolve unhandled errors to make sure your tests are not affected.',
  '',
  '⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯',
  'Error: [vitest] No "isThrottleError" export is defined on the "some-lib" mock. Did you forget to return it from "vi.mock"?',
  ' ❱ describeError src/lib/error-policy.ts:68',
  ' ❱ Object.onError src/hooks/use-orders.tsx:274',
  'This error originated in "src/__tests__/hooks/use-orders.test.tsx" test file.',
  '',
  '⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯',
  'Error: [vitest] No "isThrottleError" export is defined on the "some-lib" mock.',
  ' ❱ describeError src/lib/error-policy.ts:68',
  'This error originated in "src/__tests__/hooks/use-invoices.test.tsx" test file.',
  '',
  ' Test Files  241 passed (241)',
  '      Tests  4363 passed (4363)',
  '     Errors  3 errors',
  '   Start at  02:11:05',
].join('\n');

describe('extractUnhandledErrorReport', () => {
  it('returns every block and the Errors summary from a real stderr blob', () => {
    const { blocks, summary } = extractUnhandledErrorReport(STDERR);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain('Vitest caught 3 errors during the test run.');
    expect(blocks[0]).toContain('use-orders.test.tsx');
    expect(blocks[1]).toContain('use-invoices.test.tsx');
    expect(summary).toEqual(['Errors  3 errors']);
  });

  it('keeps each block WHOLE — the missing export, the stack, and the originating file', () => {
    const [first] = extractUnhandledErrorReport(STDERR).blocks;
    expect(first).toContain('No "isThrottleError" export is defined');
    expect(first).toContain('src/lib/error-policy.ts:68');
    expect(first).toContain('Object.onError src/hooks/use-orders.tsx:274');
    expect(first!.trimEnd().endsWith('test file.')).toBe(true);
  });

  it('never swallows the block when the stream is cut before the originating line', () => {
    const truncated = STDERR.slice(0, STDERR.indexOf('This error originated'));
    expect(extractUnhandledErrorReport(truncated).blocks.at(-1)).toContain(
      'No "isThrottleError" export is defined',
    );
  });

  it('reports nothing for a clean run', () => {
    const clean = ' Test Files  241 passed (241)\n      Tests  4363 passed (4363)\n';
    expect(extractUnhandledErrorReport(clean)).toEqual({ blocks: [], summary: [] });
    expect(formatUnhandledErrorReport(clean)).toBeNull();
    expect(formatUnhandledErrorReport(undefined)).toBeNull();
  });

  it('formats the blocks and summary untruncated', () => {
    const rendered = formatUnhandledErrorReport(STDERR)!;
    expect(rendered).toContain('2 unhandled error blocks');
    expect(rendered).toContain('Vitest caught 3 errors during the test run.');
    expect(rendered).toContain('use-orders.test.tsx');
    expect(rendered).toContain('use-invoices.test.tsx');
    expect(rendered).toContain('Errors  3 errors');
  });

  it('handles CRLF output and a singular error count', () => {
    const crlf = [
      '⎯ Unhandled Error ⎯',
      'Vitest caught 1 error during the test run.',
      'This error originated in "src/__tests__/x.test.ts" test file.',
      '     Errors  1 error',
    ].join('\r\n');
    const { blocks, summary } = extractUnhandledErrorReport(crlf);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain('x.test.ts');
    expect(summary).toEqual(['Errors  1 error']);
  });
});
