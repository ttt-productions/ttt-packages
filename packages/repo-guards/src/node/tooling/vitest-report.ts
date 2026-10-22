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

// Vitest may print other text around the JSON object.
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

// A test file that failed to load carries its error as the file's own `message` and adds nothing
// to `numFailedTests`.
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
