import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './leak-utils';

// On Windows the `forks` pool's temp-file rename fails (`EPERM`) while another process holds
// the file, and a root config `pool` does not reach the projects, so scripts pass --pool=threads.

// The root package.json maps each script name to its command.
const { scripts } = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};
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
