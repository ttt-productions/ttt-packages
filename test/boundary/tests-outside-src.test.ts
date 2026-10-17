import { describe, expect, it } from 'vitest';
import { FILE_KINDS } from '@ttt-productions/repo-guards/node';
import { packageSource } from './workspace';

// Every package tsconfig compiles all of `src` into the published `dist`, so a test under `src`
// ships to consumers as compiled test code, declarations, and maps. Package tests live in the
// package's own `__tests__/` folder beside `src`, which no package build emits.

const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const TEST_FOLDER = /^__(tests|mocks)__$/;

const sourceFiles = packageSource(FILE_KINDS);

describe('boundary: tests stay out of published package source', () => {
  it('scans a plausible number of package source files', () => {
    expect(sourceFiles.length).toBeGreaterThan(100);
  });

  it('places no test file or test folder under any package src', () => {
    const misplaced = sourceFiles
      .map((file) => file.path)
      .filter((file) => TEST_FILE.test(file) || file.split('/').some((segment) => TEST_FOLDER.test(segment)));
    expect(
      misplaced,
      `move these into the package's __tests__/ folder, beside src:\n  ${misplaced.join('\n  ')}`,
    ).toEqual([]);
  });
});
