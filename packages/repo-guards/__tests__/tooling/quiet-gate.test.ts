import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SLOW_TEST_TIMEOUT_MS } from '../../../../test/timeouts.js';
import {
  runQuietGate,
  selectStages,
  type GatePhase,
  type GateStage,
} from '../../src/node/tooling/quiet-gate.js';

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

describe('selectStages by phase', () => {
  const ids = ['lint', 'vitest', 'rules', 'e2e'];
  const phases = { vitest: 'live', rules: 'live', e2e: 'live' } as const;

  it('runs every stage of the named phase, in declared order', () => {
    expect(selectStages(['--phase', 'live'], ids, phases)).toEqual({
      kind: 'run',
      only: new Set(['vitest', 'rules', 'e2e']),
    });
    expect(selectStages(['--phase=start'], ids, phases)).toEqual({
      kind: 'run',
      only: new Set(['lint']),
    });
  });

  it('puts a stage that declares no phase in the start phase', () => {
    expect(selectStages(['--phase', 'start'], ids)).toEqual({
      kind: 'run',
      only: new Set(ids),
    });
  });

  it('refuses an unknown phase, a phase with no stages, and a phase combined with --only', () => {
    const message = (argv: string[], given: Readonly<Record<string, GatePhase>> = phases) => {
      const selection = selectStages(argv, ids, given);
      return selection.kind === 'usage-error' ? selection.message : selection.kind;
    };
    expect(message(['--phase', 'later'])).toMatch(/Unknown phase: later/);
    expect(message(['--phase'])).toMatch(/Unknown phase: \(none\)/);
    expect(message(['--phase', 'live'], {})).toMatch(/The live phase declares no stage/);
    expect(message(['--phase', 'live', '--only', 'lint'])).toMatch(/takes no --only/);
    expect(message(['--phase', 'live', '--lint'])).toMatch(/takes no --only/);
  });

  it('keeps running every stage when neither --phase nor --only is given', () => {
    expect(selectStages([], ids, phases)).toEqual({ kind: 'run', only: null });
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
    writeFileSync(
      path.join(dir, 'say.mjs'),
      'console.log(process.argv[2]); process.exit(Number(process.argv[3] ?? 0));',
    );
    writeFileSync(
      path.join(dir, 'long-fail.mjs'),
      "console.error('first line of a long failure'); console.error('x'.repeat(20000)); console.error('last line of a long failure'); process.exit(1);",
    );
    freePort = await new Promise<number>((resolve) => {
      const server = net.createServer().listen(0, '127.0.0.1', () => {
        const { port } = server.address() as net.AddressInfo;
        server.close(() => resolve(port));
      });
    });
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');

  afterEach(() => {
    vi.restoreAllMocks();
    if (ttyDescriptor) Object.defineProperty(process.stdout, 'isTTY', ttyDescriptor);
    else Reflect.deleteProperty(process.stdout, 'isTTY');
  });

  const logDir = (): string => path.join(dir, 'logs');
  const logFile = (name: string): string => path.join(logDir(), name);

  async function run(
    stages: GateStage[],
    argv: string[],
    folder: string = logDir(),
  ): Promise<number> {
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
      await runQuietGate({ title: 'test gate', script: 'gate.mjs', logDir: folder, stages }, argv);
    } catch (error) {
      if (error instanceof Exit) return error.code;
      throw error;
    }
    throw new Error('the gate returned without exiting');
  }

  const command = (
    id: string,
    script: string,
    stopOnFailure = true,
    args: readonly string[] = [],
    label = `${id} step`,
  ): GateStage => ({
    id,
    description: id,
    stopOnFailure,
    steps: () => [{ kind: 'command', label, command: 'node', args: [script, ...args], cwd: dir }],
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

  describe('a live stage whose services listen', () => {
    let server: net.Server;
    let livePort: number;

    beforeAll(async () => {
      server = net.createServer();
      livePort = await new Promise<number>((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve((server.address() as net.AddressInfo).port));
      });
    });

    afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

    const liveWith = (ready: () => Promise<string | null>, readyWaitMs: number): GateStage => ({
      ...command('live', 'pass.mjs'),
      services: [{ name: 'functions', port: livePort, ready }],
      readyWaitMs,
    });

    it(
      'waits until a service reports ready, then runs the stage',
      async () => {
        let asked = 0;
        const ready = async (): Promise<string | null> =>
          ++asked < 2 ? 'triggers still loading' : null;
        expect(await run([liveWith(ready, SLOW_TEST_TIMEOUT_MS)], ['--only', 'live'])).toBe(0);
        expect(asked).toBe(2);
        expect(output).toContain('live step');
        expect(output).toContain('All stages passed');
      },
      SLOW_TEST_TIMEOUT_MS,
    );

    it(
      'fails the stage, naming why, when a service never reports ready, even in a full run',
      async () => {
        const ready = async (): Promise<string | null> => '3 of 9 functions not loaded (a, b, c)';
        expect(await run([liveWith(ready, 0)], [])).toBe(1);
        expect(output).toContain(
          'local services not ready: functions: 3 of 9 functions not loaded (a, b, c)',
        );
        expect(output).not.toContain('skipped');
      },
      SLOW_TEST_TIMEOUT_MS,
    );
  });

  it(
    'a failed command step keeps its whole output in its file, past what the console prints',
    async () => {
      expect(await run([command('a', 'long-fail.mjs')], [])).toBe(1);
      expect(output).toContain('last line of a long failure');
      expect(output).not.toContain('first line of a long failure');
      expect(output).toContain('earlier characters are in the file');
      const saved = readFileSync(logFile('a-step.log'), 'utf8');
      expect(saved).toContain('first line of a long failure');
      expect(saved).toContain('x'.repeat(20000));
      expect(saved).toContain('last line of a long failure');
      expect(output).toContain(`Full output: ${logFile('a-step.log')}`);
      expect(output.split(logDir()).length - 1).toBe(2);
      expect(output).toContain(`Each step's full output: ${logDir()}`);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "a step's next run replaces its own file and leaves another step's file in place",
    async () => {
      const a = (word: string): GateStage => command('a', 'say.mjs', true, [word]);
      expect(await run([a('first-a'), command('b', 'say.mjs', true, ['first-b'])], [])).toBe(0);
      expect(readFileSync(logFile('a-step.log'), 'utf8')).toContain('first-a');
      expect(
        await run([a('second-a'), command('b', 'say.mjs', true, ['second-b'])], ['--only', 'a']),
      ).toBe(0);
      const aSaved = readFileSync(logFile('a-step.log'), 'utf8');
      expect(aSaved).toContain('second-a');
      expect(aSaved).not.toContain('first-a');
      expect(readFileSync(logFile('b-step.log'), 'utf8')).toContain('first-b');
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "names a step's file for its label: lower case, each run of other characters one dash",
    async () => {
      const label = 'Audit (prod deps, high)';
      expect(await run([command('audit', 'say.mjs', true, ['audited'], label)], [])).toBe(0);
      expect(readFileSync(logFile('audit-prod-deps-high.log'), 'utf8')).toContain('audited');
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "refuses a step whose label names another step's file in the same run",
    async () => {
      const stages = [
        command('a', 'say.mjs', false, ['from-a'], 'Lint'),
        command('b', 'say.mjs', false, ['from-b'], 'lint'),
      ];
      expect(await run(stages, [])).toBe(1);
      expect(output).toContain(`lint.log is already step "Lint"'s in this run`);
      expect(readFileSync(logFile('lint.log'), 'utf8')).toContain('from-a');
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    'writes no escape sequence when stdout is not a terminal, and colours a terminal',
    async () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
      expect(await run([command('a', 'pass.mjs', false), command('b', 'fail.mjs')], [])).toBe(1);
      expect(output).toContain('the reason it failed');
      expect(output).not.toContain('\x1b');
      Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
      expect(await run([command('a', 'pass.mjs', false), command('b', 'fail.mjs')], [])).toBe(1);
      expect(output).toContain('\x1b[31m');
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  describe('a check step with a repair', () => {
    const checked = (repairScript: string): GateStage => ({
      id: 'schema',
      description: 'schema',
      stopOnFailure: true,
      steps: () => [
        {
          kind: 'command',
          label: 'schema',
          command: 'node',
          args: ['say.mjs', 'the-check-output', '1'],
          cwd: dir,
          repair: {
            command: 'node',
            args: [repairScript, 'the-repair-output'],
            note: 'regenerated; commit the docs',
          },
        },
      ],
    });

    it(
      'passes, carrying its note, when the check fails and the repair passes, and keeps both outputs',
      async () => {
        expect(await run([checked('say.mjs')], [])).toBe(0);
        expect(output).toContain('schema (regenerated; commit the docs');
        expect(output).toContain('All stages passed — schema: regenerated; commit the docs');
        const saved = readFileSync(logFile('schema.log'), 'utf8');
        expect(saved).toContain('the-check-output');
        expect(saved).toContain('the-repair-output');
      },
      SLOW_TEST_TIMEOUT_MS,
    );

    it(
      'fails, printing the repair output, when the repair fails too',
      async () => {
        expect(await run([checked('fail.mjs')], [])).toBe(1);
        expect(output).toContain('the reason it failed');
        expect(output).not.toContain('All stages passed');
      },
      SLOW_TEST_TIMEOUT_MS,
    );
  });

  describe('a Vitest step run through an npm script of the repo', () => {
    const fileResult = (over: object): object => ({
      name: 'C:/repo/a.test.ts',
      status: 'passed',
      message: '',
      assertionResults: [{ status: 'passed', title: 'works', fullName: 'a works' }],
      ...over,
    });
    const viaScript = (reportFile: string): GateStage => ({
      id: 'test',
      description: 'test',
      stopOnFailure: true,
      steps: () => [{ kind: 'vitest', label: 'vitest', cwd: dir, npmScript: reportFile }],
    });

    beforeAll(() => {
      const reports = {
        green: { numPassedTests: 1, numTotalTests: 1, testResults: [fileResult({})] },
        hook: {
          numPassedTests: 1,
          numTotalTests: 1,
          testResults: [fileResult({ status: 'failed', message: 'Hook timed out in 15000ms.' })],
        },
        skipped: {
          numPassedTests: 1,
          numPendingTests: 1,
          numTotalTests: 2,
          testResults: [
            fileResult({
              assertionResults: [
                { status: 'passed', title: 'works', fullName: 'a works' },
                { status: 'skipped', title: 'later', fullName: 'a later' },
              ],
            }),
          ],
        },
      };
      const scripts: Record<string, string> = {};
      for (const [name, report] of Object.entries(reports)) {
        writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(report));
        scripts[name] = `node print-report.mjs ${name}.json`;
      }
      writeFileSync(
        path.join(dir, 'print-report.mjs'),
        "import { readFileSync } from 'node:fs'; const failed = process.argv[2] === 'hook.json'; process.stdout.write(readFileSync(process.argv[2], 'utf8')); process.exit(failed ? 1 : 0);",
      );
      writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ private: true, scripts }));
    });

    it(
      'reads the report the script prints and keeps it beside the output',
      async () => {
        expect(await run([viaScript('green')], [])).toBe(0);
        expect(output).toContain('vitest (1 passed');
        expect(JSON.parse(readFileSync(logFile('vitest.json'), 'utf8'))).toMatchObject({
          numPassedTests: 1,
        });
      },
      SLOW_TEST_TIMEOUT_MS,
    );

    it(
      'fails on a file whose hook failed, naming it as a failure outside a test',
      async () => {
        expect(await run([viaScript('hook')], [])).toBe(1);
        expect(output).toContain('1 file failed outside a test');
        expect(output).toContain('C:/repo/a.test.ts');
        expect(output).toContain('Hook timed out in 15000ms.');
      },
      SLOW_TEST_TIMEOUT_MS,
    );

    it(
      'fails on a skipped test though the run exited 0',
      async () => {
        expect(await run([viaScript('skipped')], [])).toBe(1);
        expect(output).toContain('a later');
      },
      SLOW_TEST_TIMEOUT_MS,
    );
  });

  it("lists the script's own flags in the help", async () => {
    output = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      output += String(chunk);
      return true;
    });
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Exit(Number(code ?? 0));
    });
    await expect(
      runQuietGate(
        {
          title: 'test gate',
          script: 'gate.mjs',
          logDir: logDir(),
          stages: [command('a', 'pass.mjs')],
          flags: [{ flag: '--check-only', description: 'the format stage only checks' }],
        },
        ['--help'],
      ),
    ).rejects.toBeInstanceOf(Exit);
    expect(output).toContain('--check-only');
    expect(output).toContain('the format stage only checks');
  });

  it.each([[''], ['relative/logs']])(
    'refuses a config whose output folder is %j before any stage runs',
    async (folder) => {
      expect(await run([command('a', 'pass.mjs')], [], folder)).toBe(2);
      expect(output).toContain('The quiet gate config names no output folder');
      expect(output).not.toContain('Running test gate');
    },
  );

  it('a usage error exits 2 before any stage runs', async () => {
    expect(await run([command('a', 'pass.mjs')], ['--only', 'nope'])).toBe(2);
    expect(output).not.toContain('Running test gate');
  });
});
