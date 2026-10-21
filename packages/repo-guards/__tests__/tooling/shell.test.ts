// The tooling hands a shell one command string, so every token it joins must be one cmd.exe and sh
// read literally; a token that is not is refused before anything runs.

import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SLOW_TEST_TIMEOUT_MS } from '../../../../test/timeouts.js';
import {
  SHELL_SAFE_TOKEN,
  isMainModule,
  runCommand,
  runNpmScript,
} from '../../src/node/tooling/shell.js';

describe('SHELL_SAFE_TOKEN', () => {
  it('accepts commands, subcommands, flags, flag values, and relative script paths', () => {
    for (const token of [
      'npm',
      'npx',
      'run',
      'lint:all',
      '--omit=dev',
      '--reporter=json',
      '--config',
      'vitest.config.rules.ts',
      'scripts/x.mjs',
      '@scope/pkg',
    ]) {
      expect(SHELL_SAFE_TOKEN.test(token), token).toBe(true);
    }
  });

  it('rejects every token cmd.exe or sh would reinterpret', () => {
    for (const token of [
      '',
      'a b',
      'a&b',
      'a|b',
      'a;b',
      'a<b',
      'a>b',
      '$HOME',
      '%PATH%',
      'a^b',
      '`id`',
      '"q"',
      "'q'",
      'a\\b',
      '*',
      '!x',
      '(x)',
      'a\nb',
    ]) {
      expect(SHELL_SAFE_TOKEN.test(token), JSON.stringify(token)).toBe(false);
    }
  });
});

describe('runCommand', () => {
  it('refuses an unsafe token without running anything', async () => {
    const result = await runCommand('node', ['-e', 'process.exit(0)']);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/is not a shell-safe token/);
  });

  it(
    'runs a command and reports its exit code and output',
    async () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'tooling-run-'));
      try {
        writeFileSync(
          path.join(dir, 'probe.mjs'),
          "console.log('out'); console.error('err'); process.exit(4);",
        );
        const result = await runCommand('node', ['probe.mjs'], { cwd: dir });
        expect(result).toMatchObject({ code: 4 });
        expect(result.stdout).toContain('out');
        expect(result.stderr).toContain('err');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    SLOW_TEST_TIMEOUT_MS,
  );
});

describe('runNpmScript', () => {
  it(
    'runs an npm script on this platform with the environment it is handed',
    () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'tooling-npm-'));
      try {
        const probe = `node -e "process.exit(process.env.PARITY_PROBE === 'yes' ? 0 : 3)"`;
        writeFileSync(
          path.join(dir, 'package.json'),
          JSON.stringify({ name: 'probe', private: true, scripts: { probe } }),
        );
        expect(
          runNpmScript('probe', {
            cwd: dir,
            env: { ...process.env, PARITY_PROBE: 'yes' },
            stdio: 'pipe',
          }),
        ).toBe(0);
        expect(
          runNpmScript('probe', {
            cwd: dir,
            env: { ...process.env, PARITY_PROBE: 'no' },
            stdio: 'pipe',
          }),
        ).toBe(3);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it('refuses a script name a shell could reinterpret', () => {
    for (const script of ['', 'build && echo', 'build;x', 'a|b', '$X', '%X%', 'a b']) {
      expect(
        () => runNpmScript(script, { cwd: '.', env: process.env }),
        JSON.stringify(script),
      ).toThrow(/not a plain script name/);
    }
  });
});

describe('isMainModule', () => {
  it('is true only for the script Node was started with', () => {
    expect(isMainModule(pathToFileURL(path.resolve(process.argv[1]!)).href)).toBe(true);
    expect(isMainModule(pathToFileURL(path.resolve('not-the-entry.mjs')).href)).toBe(false);
  });
});
