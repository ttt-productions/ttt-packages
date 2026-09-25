import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { REPO_ROOT } from './leak-utils';

// Every package tsconfig compiles all of `src` into the published `dist`, so a test under `src`
// ships to consumers as compiled test code, declarations, and maps. Package tests live in the
// package's own `__tests__/` folder beside `src`, which no package build emits.

const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const TEST_FOLDER = /^__(tests|mocks)__$/;

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

const packagesDir = join(REPO_ROOT, 'packages');
const sourceFiles = readdirSync(packagesDir).flatMap((pkg) => listFiles(join(packagesDir, pkg, 'src')));
const rel = (file: string) => relative(REPO_ROOT, file).split(sep).join('/');

describe('boundary: tests stay out of published package source', () => {
  it('scans a plausible number of package source files', () => {
    expect(sourceFiles.length).toBeGreaterThan(100);
  });

  it('places no test file or test folder under any package src', () => {
    const misplaced = sourceFiles
      .map(rel)
      .filter((file) => TEST_FILE.test(file) || file.split('/').some((segment) => TEST_FOLDER.test(segment)));
    expect(
      misplaced,
      `move these into the package's __tests__/ folder, beside src:\n  ${misplaced.join('\n  ')}`,
    ).toEqual([]);
  });
});
