import { describe, it, expect } from 'vitest';
import {
  collectPlaywrightFailures,
  FLAKY_LOG_HEADER,
  flakyLogRows,
} from '../../src/node/tooling/playwright-report.js';

const report = {
  suites: [
    {
      title: 'orders.spec.ts',
      file: 'orders.spec.ts',
      specs: [
        {
          title: 'places an order',
          tests: [{ status: 'expected', results: [{ status: 'passed' }] }],
        },
        {
          title: 'cancels an order',
          tests: [
            {
              status: 'unexpected',
              results: [
                {
                  status: 'failed',
                  errors: [{ message: 'expected Cancelled' }, { stack: 'at x' }],
                },
              ],
            },
          ],
        },
        {
          title: 'refunds | partially',
          tests: [{ status: 'flaky', results: [{ status: 'failed' }, { status: 'passed' }] }],
        },
        { title: 'is parked', tests: [{ status: 'skipped', results: [{ status: 'skipped' }] }] },
      ],
      suites: [
        {
          title: 'admin',
          specs: [
            {
              title: 'exports',
              file: 'admin\\exports.spec.ts',
              tests: [{ results: [{ status: 'passed' }] }],
            },
          ],
        },
      ],
    },
  ],
};

describe('collectPlaywrightFailures', () => {
  const { failures, flakyTests, totals } = collectPlaywrightFailures(report);

  it('counts a retry-pass as passed and flaky, and a skipped test as skipped', () => {
    expect(totals).toEqual({ passed: 3, failed: 1, skipped: 1, flaky: 1, total: 5 });
  });

  it('names each failure by its suite trail with every error message', () => {
    expect(failures).toEqual([
      {
        file: 'orders.spec.ts',
        title: 'orders.spec.ts › cancels an order',
        messages: ['expected Cancelled', 'at x'],
      },
    ]);
  });

  it('names each retry-pass', () => {
    expect(flakyTests).toEqual([
      { file: 'orders.spec.ts', title: 'orders.spec.ts › refunds | partially' },
    ]);
  });
});

describe('flaky-log rows', () => {
  const flaky = [{ file: 'admin\\exports.spec.ts', title: 'exports | csv' }];
  const at = new Date('2030-01-02T03:04:05.000Z');

  it('a row holds the UTC time, the spec with forward slashes, and the title with pipes escaped', () => {
    expect(flakyLogRows(flaky, at)).toBe(
      '| 2030-01-02T03:04:05.000Z | admin/exports.spec.ts | exports \\| csv |',
    );
  });

  it('a new log starts with a header whose columns match the rows', () => {
    expect(FLAKY_LOG_HEADER).toBe(
      '# E2E retry-pass log\n\n| Time (UTC) | File | Test |\n|---|---|---|\n',
    );
  });
});
