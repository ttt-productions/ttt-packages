// Reads Vitest's JSON report for the quiet gate. A Vitest stage is red whenever Vitest exits
// non-zero, and the red output has to say why. Two failure kinds reach the report: a failed test,
// and a test FILE that failed to load (an import that threw, a syntax error), which carries its
// error as the file's own `message` and adds nothing to `numFailedTests`. Both are collected.

export interface VitestAssertion {
  status?: string;
  title?: string;
  fullName?: string;
  failureMessages?: string[];
}

export interface VitestFileResult {
  name: string;
  status?: string;
  message?: string;
  assertionResults?: VitestAssertion[];
}

export interface VitestJsonReport {
  testResults?: VitestFileResult[];
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
  numTodoTests?: number;
  numTotalTests?: number;
}

export interface TestFailure {
  file: string;
  title: string;
  messages: string[];
}

export interface SuiteFailure {
  file: string;
  message: string;
}

export interface SkippedTest {
  file: string;
  title: string;
  status: string;
}

export interface VitestTotals {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  failedSuites: number;
}

/**
 * The report object from Vitest's `--reporter=json` stdout, or null when none parses. Vitest may
 * print other text around it, so the object between the first `{` and the last `}` is tried too.
 */
export function parseVitestJson(stdout: string): VitestJsonReport | null {
  const trimmed = stdout.trim();
  try {
    return JSON.parse(trimmed) as VitestJsonReport;
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first === -1 || last === -1 || last < first) return null;
    try {
      return JSON.parse(trimmed.slice(first, last + 1)) as VitestJsonReport;
    } catch {
      return null;
    }
  }
}

/**
 * The failed tests, the files that failed to load, the skipped or pending tests, and the stage
 * totals of one report. A file failed to load when its status is `failed` and none of its tests
 * failed; its error is the file's own message.
 */
export function collectVitestFailures(report: VitestJsonReport | null): {
  failures: TestFailure[];
  suiteFailures: SuiteFailure[];
  skippedTests: SkippedTest[];
  totals: VitestTotals | null;
} {
  if (!report) return { failures: [], suiteFailures: [], skippedTests: [], totals: null };
  const failures: TestFailure[] = [];
  const suiteFailures: SuiteFailure[] = [];
  const skippedTests: SkippedTest[] = [];
  for (const file of report.testResults ?? []) {
    let failedTests = 0;
    for (const a of file.assertionResults ?? []) {
      const title = a.fullName || a.title || '';
      if (a.status === 'failed') {
        failedTests += 1;
        failures.push({ file: file.name, title, messages: a.failureMessages ?? [] });
      } else if (a.status === 'skipped' || a.status === 'pending' || a.status === 'todo') {
        skippedTests.push({ file: file.name, title, status: a.status });
      }
    }
    if (file.status === 'failed' && failedTests === 0) {
      suiteFailures.push({
        file: file.name,
        message: file.message || '(no error message in the report)',
      });
    }
  }
  const totals: VitestTotals = {
    passed: report.numPassedTests ?? 0,
    failed: report.numFailedTests ?? 0,
    // `.skip` and `xit` land in numPendingTests; `.todo` is counted on its own.
    skipped: (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0),
    total: report.numTotalTests ?? 0,
    failedSuites: suiteFailures.length,
  };
  return { failures, suiteFailures, skippedTests, totals };
}

/**
 * A Vitest stage's verdict: green only when Vitest exited 0, no test failed, no file failed to
 * load, and no test was skipped or left pending — a skipped test proves nothing, so a stage that
 * passes with one is not measuring what it claims. `skippedReason` names the skips when they are
 * what keeps the stage from green.
 */
export function vitestStageVerdict({
  code,
  totals,
  suiteFailures,
}: {
  code: number;
  totals: VitestTotals | null;
  suiteFailures: SuiteFailure[];
}): { ok: boolean; skippedReason: string | null } {
  const skipped = totals?.skipped ?? 0;
  const ok =
    code === 0 &&
    totals !== null &&
    totals.failed === 0 &&
    skipped === 0 &&
    suiteFailures.length === 0;
  const skippedReason =
    skipped > 0 ? `${skipped} skipped/pending test(s) make this stage non-green.` : null;
  return { ok, skippedReason };
}

/** Each file that failed to load: its path, then its error, indented. Empty when none did. */
export function formatSuiteFailures(suiteFailures: SuiteFailure[]): string {
  return suiteFailures
    .map(
      (suite) =>
        `Failed to load: ${suite.file}\n${suite.message
          .split('\n')
          .map((line) => `    ${line}`)
          .join('\n')}`,
    )
    .join('\n\n');
}
