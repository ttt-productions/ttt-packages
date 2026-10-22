import type { TestFailure } from './vitest-report.js';

interface PlaywrightResult {
  status?: string;
  errors?: { message?: string; stack?: string }[];
}

interface PlaywrightSuite {
  title?: string;
  file?: string;
  specs?: {
    title?: string;
    file?: string;
    tests?: { status?: string; results?: PlaywrightResult[] }[];
  }[];
  suites?: PlaywrightSuite[];
}

export interface PlaywrightJsonReport {
  suites?: PlaywrightSuite[];
}

export interface FlakyTest {
  file: string;
  title: string;
}

export interface PlaywrightTotals {
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  total: number;
}

export function collectPlaywrightFailures(report: PlaywrightJsonReport): {
  failures: TestFailure[];
  flakyTests: FlakyTest[];
  totals: PlaywrightTotals;
} {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let flaky = 0;
  const failures: TestFailure[] = [];
  const flakyTests: FlakyTest[] = [];

  function walkSuite(suite: PlaywrightSuite, trail: string[]): void {
    const here = suite.title ? [...trail, suite.title] : trail;
    for (const spec of suite.specs ?? []) {
      const file = spec.file || suite.file || '(unknown)';
      const title = [...here, spec.title].filter(Boolean).join(' › ');
      for (const test of spec.tests ?? []) {
        const results = test.results ?? [];
        if (test.status === 'skipped' || results.every((r) => r.status === 'skipped')) {
          skipped++;
        } else if (test.status === 'flaky') {
          flaky++;
          passed++;
          flakyTests.push({ file, title });
        } else if (results.every((r) => r.status === 'passed' || r.status === 'skipped')) {
          passed++;
        } else {
          failed++;
          const messages: string[] = [];
          for (const r of results) {
            for (const e of r.errors ?? []) {
              if (e.message) messages.push(e.message);
              else if (e.stack) messages.push(e.stack);
            }
          }
          failures.push({ file, title, messages });
        }
      }
    }
    for (const child of suite.suites ?? []) walkSuite(child, here);
  }

  for (const suite of report.suites ?? []) walkSuite(suite, []);
  return {
    failures,
    flakyTests,
    totals: { passed, failed, skipped, flaky, total: passed + failed + skipped },
  };
}

export const FLAKY_LOG_HEADER =
  '# E2E retry-pass log\n\n| Time (UTC) | File | Test |\n|---|---|---|\n';

export function flakyLogRows(flakyTests: readonly FlakyTest[], at: Date): string {
  return flakyTests
    .map((test) => {
      const file = test.file.replace(/\\/g, '/').replaceAll('|', '\\|');
      const title = test.title.replaceAll('|', '\\|');
      return `| ${at.toISOString()} | ${file} | ${title} |`;
    })
    .join('\n');
}
