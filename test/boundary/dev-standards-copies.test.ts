import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './leak-utils';

const COPIES_DIR = join(REPO_ROOT, 'packages', 'dev-standards', 'config', 'copies');
const COPIES = ['.nvmrc', '.gitattributes'] as const;

// A checkout without `eol=lf` writes the machine's own line endings, so the comparison ignores them.
const normalized = (text: string): string => text.replace(/\r\n/g, '\n');
const differs = (repoText: string, sharedText: string): boolean =>
  normalized(repoText) !== normalized(sharedText);

describe('boundary: dev-standards config copies', () => {
  for (const name of COPIES) {
    it(`the repo's ${name} matches the shared copy`, () => {
      const repoText = readFileSync(join(REPO_ROOT, name), 'utf8');
      const sharedText = readFileSync(join(COPIES_DIR, name), 'utf8');
      expect(differs(repoText, sharedText), `${name} differs from config/copies/${name}`).toBe(
        false,
      );
    });
  }

  it('a copy that differs in content fails, and one that differs only in line endings passes', () => {
    expect(differs('24\n', '22\n')).toBe(true);
    expect(differs('24\r\n', '24\n')).toBe(false);
  });
});
