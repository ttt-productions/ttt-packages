import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './leak-utils';
import { createRepoReader } from '../../packages/repo-guards/src/reader/reader.js';
import { shellSafeGuard } from '../../packages/repo-guards/src/modules/repo/shell-safe.js';

// The shared shell-safety guard run over this repository's own source through the one reader: no
// child process gets an args array together with a shell. The guard's own must-fail and must-pass
// cases are proven in its package's tests.

const reader = createRepoReader({
  repoRoot: REPO_ROOT,
  roots: {
    app: { path: 'packages', anchor: 'packages/repo-guards/src/index.ts' },
    scripts: { path: 'scripts', anchor: 'scripts/test-quiet.mjs' },
  },
});

describe('boundary: no child process gets an args array together with a shell', () => {
  const [guard] = shellSafeGuard.build({});

  it('the reader reaches every declared root', () => {
    expect(reader.unreachedAnchors()).toEqual([]);
  });

  it('finds no such call in any package or script source file', async () => {
    const findings = await guard.run({ reader, files: (scope) => reader.files(scope), file: (p) => reader.file(p) });
    const offenders = findings.map((f) => `${f.file}:${f.line}`);
    expect(offenders, `${guard.description}\n  ${offenders.join('\n  ')}`).toEqual([]);
  });
});

describe('boundary: the quiet runner hands its shell only shell-safe tokens', () => {
  const source = readFileSync(join(REPO_ROOT, 'scripts', 'test-quiet.mjs'), 'utf8');
  const declared = /^const SHELL_SAFE_TOKEN = \/(.+)\/([a-z]*);\s*$/m.exec(source);
  const safe = (token: string) => (declared ? new RegExp(declared[1], declared[2]).test(token) : false);

  it('declares SHELL_SAFE_TOKEN as a regex literal', () => {
    expect(declared, 'scripts/test-quiet.mjs no longer declares SHELL_SAFE_TOKEN').not.toBeNull();
  });

  it('accepts commands, subcommands, flags, flag values, and relative script paths', () => {
    for (const token of ['npm', 'npx', 'run', 'lint', '-b', '--noEmit', '--omit=dev', '--reporter=json', 'scripts/x.mjs', '@scope/pkg']) {
      expect(safe(token), token).toBe(true);
    }
  });

  it('rejects every token cmd.exe or sh would reinterpret', () => {
    for (const token of ['', 'a b', 'a&b', 'a|b', 'a;b', 'a<b', 'a>b', '$HOME', '%PATH%', 'a^b', '`id`', '"q"', "'q'", 'a\\b', '*', '!x', '(x)', 'a\nb']) {
      expect(safe(token), JSON.stringify(token)).toBe(false);
    }
  });
});
