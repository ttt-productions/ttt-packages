import { describe, expect, it } from 'vitest';
import { createRepoReader, type RepoLayout } from '@ttt-productions/repo-guards/node';
import { GENERIC_GUARDS, registerSuiteOf } from '@ttt-productions/repo-guards/node/suite';
import { REPO_ROOT } from './leak-utils';

// The shared shell-safety guard — no child process gets an args array together with a shell — run
// over this repository through the suite entry, exactly as an app's suite runs it: the reader's
// reach check, and the guard failing when a scope it reads reaches no file. The whole repository is
// one root, so packages, scripts, this suite, and the root config files are all read. The guard's
// own must-fail and must-pass cases are proven in its package's tests.

const layout: RepoLayout = { repoRoot: REPO_ROOT, roots: { app: { path: '.', anchor: 'scripts/test-quiet.mjs' } } };

registerSuiteOf(
  { layout, generic: { shellSafeChildProcesses: {} }, business: [] },
  GENERIC_GUARDS.filter((definition) => definition.id === 'shellSafeChildProcesses'),
);

describe('boundary: the quiet runner hands its shell only shell-safe tokens', () => {
  const source = createRepoReader(layout).file('scripts/test-quiet.mjs').text;
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
