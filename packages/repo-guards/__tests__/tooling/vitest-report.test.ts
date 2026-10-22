import { describe, it, expect } from 'vitest';
import {
  collectVitestFailures,
  formatSuiteFailures,
  parseVitestJson,
  vitestStageVerdict,
  type VitestFileResult,
  type VitestJsonReport,
} from '../../src/node/tooling/vitest-report.js';

const LOAD_ERROR = 'Configuration is incomplete. Missing: apiKey, authDomain';

const loadFailedFile: VitestFileResult = {
  name: 'C:/repo/src/components/broken-view.test.tsx',
  status: 'failed',
  message: LOAD_ERROR,
  assertionResults: [],
};

const passingFile: VitestFileResult = {
  name: 'C:/repo/src/__tests__/ok.test.ts',
  status: 'passed',
  message: '',
  assertionResults: [
    { status: 'passed', title: 'works', fullName: 'ok works', failureMessages: [] },
  ],
};

const failedAssertionFile: VitestFileResult = {
  name: 'C:/repo/src/__tests__/red.test.ts',
  status: 'failed',
  message: '',
  assertionResults: [
    {
      status: 'failed',
      title: 'adds',
      fullName: 'math adds',
      failureMessages: ['expected 3 to be 4'],
    },
  ],
};

const skippedFile: VitestFileResult = {
  name: 'C:/repo/src/__tests__/parked.test.ts',
  status: 'passed',
  message: '',
  assertionResults: [
    { status: 'passed', title: 'runs', fullName: 'parked runs', failureMessages: [] },
    { status: 'skipped', title: 'later', fullName: 'parked later', failureMessages: [] },
    { status: 'todo', title: 'someday', fullName: 'parked someday', failureMessages: [] },
  ],
};

const todoFile: VitestFileResult = {
  name: 'C:/repo/src/__tests__/planned.test.ts',
  status: 'passed',
  message: '',
  assertionResults: [
    { status: 'passed', title: 'runs', fullName: 'planned runs', failureMessages: [] },
    { status: 'todo', title: 'someday', fullName: 'planned someday', failureMessages: [] },
  ],
};

const report = (
  testResults: VitestFileResult[],
  counts: Partial<VitestJsonReport>,
): VitestJsonReport => ({
  numPassedTests: 0,
  numFailedTests: 0,
  numPendingTests: 0,
  numTotalTests: 0,
  ...counts,
  testResults,
});

describe('collectVitestFailures', () => {
  it('names a file that failed to load, with its error, though no test failed', () => {
    const { failures, suiteFailures, totals } = collectVitestFailures(
      report([passingFile, loadFailedFile], { numPassedTests: 1, numTotalTests: 1 }),
    );
    expect(failures).toEqual([]);
    expect(suiteFailures).toEqual([{ file: loadFailedFile.name, message: LOAD_ERROR }]);
    expect(totals).toMatchObject({ passed: 1, failed: 0, failedSuites: 1 });
  });

  it('reports no load failure for a run whose files all passed', () => {
    const { failures, suiteFailures, totals } = collectVitestFailures(
      report([passingFile], { numPassedTests: 1, numTotalTests: 1 }),
    );
    expect(failures).toEqual([]);
    expect(suiteFailures).toEqual([]);
    expect(totals).toMatchObject({ failedSuites: 0 });
  });

  it('reports a failed test as a test failure, never as a file that failed to load', () => {
    const { failures, suiteFailures } = collectVitestFailures(
      report([failedAssertionFile], { numFailedTests: 1, numTotalTests: 1 }),
    );
    expect(failures).toEqual([
      { file: failedAssertionFile.name, title: 'math adds', messages: ['expected 3 to be 4'] },
    ]);
    expect(suiteFailures).toEqual([]);
  });

  it('reads the report out of stdout that carries other text around it', () => {
    const stdout = `some banner\n${JSON.stringify(report([loadFailedFile], {}))}\ntrailing`;
    expect(collectVitestFailures(parseVitestJson(stdout)).suiteFailures).toHaveLength(1);
  });

  it('answers no totals when nothing parses, so the stage cannot read as green', () => {
    expect(parseVitestJson('no json here')).toBeNull();
    expect(collectVitestFailures(null).totals).toBeNull();
  });
});

describe('formatSuiteFailures', () => {
  it('prints each file that failed to load with its error, so the red stage says why', () => {
    const text = formatSuiteFailures([
      { file: loadFailedFile.name, message: `${LOAD_ERROR}\n  at config.ts` },
    ]);
    expect(text).toContain(`Failed to load: ${loadFailedFile.name}`);
    expect(text).toContain(`    ${LOAD_ERROR}`);
    expect(text).toContain('      at config.ts');
  });

  it('prints nothing when no file failed to load', () => {
    expect(formatSuiteFailures([])).toBe('');
  });
});

describe('vitestStageVerdict — a skipped test proves nothing, so the stage is never green with one', () => {
  const verdictOf = (
    testResults: VitestFileResult[],
    counts: Partial<VitestJsonReport>,
    code = 0,
  ): { ok: boolean; skippedReason: string | null } => {
    const { totals, suiteFailures } = collectVitestFailures(report(testResults, counts));
    return vitestStageVerdict({ code, totals, suiteFailures });
  };

  it('a clean run with every test passing is green', () => {
    expect(verdictOf([passingFile], { numPassedTests: 1, numTotalTests: 1 })).toEqual({
      ok: true,
      skippedReason: null,
    });
  });

  it('a run with a skipped test and no failures is NOT green, and says why', () => {
    const verdict = verdictOf([skippedFile], {
      numPassedTests: 1,
      numPendingTests: 1,
      numTotalTests: 2,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.skippedReason).toBe('1 skipped/pending test(s) make this stage non-green.');
  });

  it('a .todo test alone keeps the stage from green and is named, though Vitest counts it apart from the skipped ones', () => {
    const counts = { numPassedTests: 1, numPendingTests: 0, numTodoTests: 1, numTotalTests: 2 };
    const verdict = verdictOf([todoFile], counts);
    expect(verdict.ok).toBe(false);
    expect(verdict.skippedReason).toBe('1 skipped/pending test(s) make this stage non-green.');
    expect(collectVitestFailures(report([todoFile], counts)).skippedTests).toEqual([
      { file: todoFile.name, title: 'planned someday', status: 'todo' },
    ]);
  });

  it('a skipped test and a .todo test both count', () => {
    const verdict = verdictOf([skippedFile], {
      numPassedTests: 1,
      numPendingTests: 1,
      numTodoTests: 1,
      numTotalTests: 3,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.skippedReason).toBe('2 skipped/pending test(s) make this stage non-green.');
  });

  it('names every skipped and todo test so the red stage can say which', () => {
    const { skippedTests } = collectVitestFailures(
      report([skippedFile], { numPendingTests: 1, numTodoTests: 1 }),
    );
    expect(skippedTests).toEqual([
      { file: skippedFile.name, title: 'parked later', status: 'skipped' },
      { file: skippedFile.name, title: 'parked someday', status: 'todo' },
    ]);
  });

  it('a failed test, a file that failed to load, or a non-zero exit is still not green', () => {
    expect(verdictOf([failedAssertionFile], { numFailedTests: 1, numTotalTests: 1 }).ok).toBe(
      false,
    );
    expect(verdictOf([loadFailedFile], {}).ok).toBe(false);
    expect(verdictOf([passingFile], { numPassedTests: 1, numTotalTests: 1 }, 1).ok).toBe(false);
  });
});
