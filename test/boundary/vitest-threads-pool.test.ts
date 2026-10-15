import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './leak-utils';

// The suite runs on vitest's `threads` pool. The `forks` pool hands each worker its transformed
// modules as files written then renamed into the run's temp folder, and on Windows that rename fails
// (`EPERM`) whenever another process — a worker still reading the file, or a virus scanner — holds it,
// failing a random test and with it the release preflight. A root config `pool` does not reach the
// projects, so the pool is chosen on the command line, once, in the root scripts; the quiet gate runs
// vitest only through the `test` script.

const scripts: Record<string, string> = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')).scripts;
const quietGate = readFileSync(join(REPO_ROOT, 'scripts', 'test-quiet.mjs'), 'utf8');

describe('the suite runs on the threads pool', () => {
  it('passes --pool=threads to every root script that runs vitest', () => {
    const offenders = Object.entries(scripts)
      .filter(([, command]) => /\bvitest\b/.test(command) && !/--pool=threads\b/.test(command))
      .map(([name, command]) => `${name}: ${command}`);
    expect(offenders).toEqual([]);
    expect(scripts.test).toMatch(/^vitest run\b/);
  });

  it('runs vitest in the quiet gate only through the test script, never by spawning it itself', () => {
    expect(quietGate).not.toMatch(/['"]vitest['"]\s*,\s*['"]run['"]/);
    expect(quietGate).toMatch(/\[\s*'run'\s*,\s*'--silent'\s*,\s*'test'\s*,\s*'--'/);
  });
});
