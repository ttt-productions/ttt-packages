// The quiet gate: a command line that names no stage, or a misspelled one, is a usage error before
// anything runs; a failed static stage stops the run; a live stage whose services are down is
// skipped in a full run but FAILS when named.

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SLOW_TEST_TIMEOUT_MS } from '../../../../test/timeouts.js';
import { runQuietGate, selectStages, type GateStage } from '../../src/node/tooling/quiet-gate.js';

describe('selectStages', () => {
  const ids = ['lint', 'vitest', 'e2e'];

  it.each([[['--only', ',']], [['--only', ' , ']], [['--only=,']], [['--only=']], [['--only']]])(
    'refuses %j as a usage error',
    (argv) => {
      const selection = selectStages(argv, ids);
      expect(selection.kind).toBe('usage-error');
      expect(selection.kind === 'usage-error' && selection.message).toMatch(
        /--only names no stage/,
      );
    },
  );

  it('refuses a misspelled stage name', () => {
    const selection = selectStages(['--only', 'vitset'], ids);
    expect(selection.kind === 'usage-error' && selection.message).toMatch(
      /Unknown stage\(s\): vitset/,
    );
  });

  it('reads both --only forms, a comma list, and the --<stage> shortcuts', () => {
    expect(selectStages(['--only', 'lint,e2e'], ids)).toEqual({
      kind: 'run',
      only: new Set(['lint', 'e2e']),
    });
    expect(selectStages(['--only=vitest'], ids)).toEqual({
      kind: 'run',
      only: new Set(['vitest']),
    });
    expect(selectStages(['--e2e', '--lint'], ids)).toEqual({
      kind: 'run',
      only: new Set(['lint', 'e2e']),
    });
    expect(selectStages([], ids)).toEqual({ kind: 'run', only: null });
    expect(selectStages(['--help'], ids)).toEqual({ kind: 'help' });
  });
});

class Exit extends Error {
  constructor(readonly code: number) {
    super(`exit ${code}`);
  }
}

describe('runQuietGate', () => {
  let dir: string;
  let freePort: number;
  let output: string;

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'tooling-gate-'));
    writeFileSync(path.join(dir, 'pass.mjs'), 'process.exit(0);');
    writeFileSync(
      path.join(dir, 'fail.mjs'),
      "console.error('the reason it failed'); process.exit(1);",
    );
    // A port that was free a moment ago stands in for a local service that is not running.
    freePort = await new Promise<number>((resolve) => {
      const server = net.createServer().listen(0, '127.0.0.1', () => {
        const { port } = server.address() as net.AddressInfo;
        server.close(() => resolve(port));
      });
    });
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  afterEach(() => vi.restoreAllMocks());

  async function run(stages: GateStage[], argv: string[]): Promise<number> {
    output = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      output += String(chunk);
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      output += String(chunk);
      return true;
    });
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Exit(Number(code ?? 0));
    });
    try {
      await runQuietGate({ title: 'test gate', script: 'gate.mjs', stages }, argv);
    } catch (error) {
      if (error instanceof Exit) return error.code;
      throw error;
    }
    throw new Error('the gate returned without exiting');
  }

  const command = (id: string, script: string, stopOnFailure = true): GateStage => ({
    id,
    description: id,
    stopOnFailure,
    steps: () => [
      { kind: 'command', label: `${id} step`, command: 'node', args: [script], cwd: dir },
    ],
  });

  it(
    'passes when every stage passes',
    async () => {
      expect(await run([command('a', 'pass.mjs'), command('b', 'pass.mjs')], [])).toBe(0);
      expect(output).toContain('All stages passed');
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    'a failed static stage stops the run, prints its output, and exits 1',
    async () => {
      expect(await run([command('a', 'fail.mjs'), command('b', 'pass.mjs')], [])).toBe(1);
      expect(output).toContain('✖');
      expect(output).toContain('the reason it failed');
      expect(output).not.toContain('b step');
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    'a failed stage that does not stop the run lets the next stage run, and the run still fails',
    async () => {
      expect(await run([command('a', 'fail.mjs', false), command('b', 'pass.mjs')], [])).toBe(1);
      expect(output).toContain('b step');
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    'a live stage whose services are down is skipped in a full run, and FAILS when named',
    async () => {
      const live: GateStage = {
        ...command('live', 'pass.mjs'),
        services: [{ name: 'emulator', port: freePort }],
        startHint: 'start the stack',
      };
      expect(await run([command('a', 'pass.mjs'), live], [])).toBe(0);
      expect(output).toContain('skipped — local services not running: emulator');
      expect(await run([command('a', 'pass.mjs'), live], ['--only', 'live'])).toBe(1);
      expect(output).toContain('local services not running: emulator');
      expect(output).toContain('start the stack, then rerun');
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it('a usage error exits 2 before any stage runs', async () => {
    expect(await run([command('a', 'pass.mjs')], ['--only', 'nope'])).toBe(2);
    expect(output).not.toContain('Running test gate');
  });
});
