import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  collectPlaywrightFailures,
  FLAKY_LOG_HEADER,
  flakyLogRows,
  type FlakyTest,
  type PlaywrightJsonReport,
  type PlaywrightTotals,
} from './playwright-report.js';
import {
  collectVitestFailures,
  formatSuiteFailures,
  parseVitestJson,
  vitestStageVerdict,
  type TestFailure,
} from './vitest-report.js';
import { formatUnhandledErrorReport } from './vitest-unhandled-errors.js';
import { runCommand } from './shell.js';

export type GateStep =
  | { kind: 'command'; label: string; command: string; args: readonly string[]; cwd: string }
  | { kind: 'vitest'; label: string; args?: readonly string[]; cwd: string }
  | {
      kind: 'playwright';
      label: string;
      cwd: string;
      flakyLogPath: string;
      clearBeforeRun?: readonly string[];
    };

export interface LiveService {
  name: string;
  port: number;
  ready?: () => Promise<string | null>;
}

export const GATE_PHASES = ['start', 'live'] as const;
export type GatePhase = (typeof GATE_PHASES)[number];

export interface GateStage {
  id: string;
  description: string;
  phase?: GatePhase;
  stopOnFailure: boolean;
  steps: () => readonly GateStep[];
  services?: readonly LiveService[];
  startHint?: string;
  readyWaitMs?: number;
}

export const READY_WAIT_MS = 180_000;
export const READY_POLL_MS = 1_000;

export interface QuietGateConfig {
  title: string;
  script: string;
  logDir: string;
  stages: readonly GateStage[];
}

const ANSI = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  CYAN: '\x1b[36m',
  DIM: '\x1b[2m',
  BOLD: '\x1b[1m',
  RESET: '\x1b[0m',
} as const;

type Palette = Record<keyof typeof ANSI, string>;

const NO_COLOUR: Palette = {
  RED: '',
  GREEN: '',
  YELLOW: '',
  CYAN: '',
  DIM: '',
  BOLD: '',
  RESET: '',
};

const paletteFor = (stream: { isTTY?: boolean }): Palette => (stream.isTTY ? ANSI : NO_COLOUR);

interface StepFiles {
  output: string;
  report: string;
}

function stepFileStem(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
}

const outputFileText = (stdout: string, stderr: string): string =>
  `--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`;

type Totals = { passed: number; failed: number; skipped: number; flaky?: number };
type StepResult = { name: string; ok?: boolean; skipped?: boolean; totals?: Totals | null };

export type GateSelection =
  | { kind: 'help' }
  | { kind: 'usage-error'; message: string }
  | { kind: 'run'; only: ReadonlySet<string> | null };

export function selectStages(
  argv: readonly string[],
  stageIds: readonly string[],
  phases: Readonly<Record<string, GatePhase | undefined>> = {},
): GateSelection {
  if (argv.includes('--help') || argv.includes('-h')) return { kind: 'help' };
  const phaseEq = argv.find((a) => a.startsWith('--phase='));
  const phaseAt = argv.indexOf('--phase');
  if (phaseEq || phaseAt >= 0) {
    const phase = phaseEq ? phaseEq.slice('--phase='.length) : (argv[phaseAt + 1] ?? '');
    if (!(GATE_PHASES as readonly string[]).includes(phase)) {
      return {
        kind: 'usage-error',
        message: `Unknown phase: ${phase || '(none)'}\nValid phases: ${GATE_PHASES.join(', ')}`,
      };
    }
    const namesStages =
      argv.some((a) => a === '--only' || a.startsWith('--only=')) ||
      stageIds.some((id) => argv.includes(`--${id}`));
    if (namesStages) {
      return {
        kind: 'usage-error',
        message: '--phase runs a whole phase and takes no --only or stage flag',
      };
    }
    const only = new Set(stageIds.filter((id) => (phases[id] ?? 'start') === phase));
    if (only.size === 0) {
      return { kind: 'usage-error', message: `The ${phase} phase declares no stage` };
    }
    return { kind: 'run', only };
  }
  const eq = argv.find((a) => a.startsWith('--only='));
  const at = argv.indexOf('--only');
  let onlyRaw: string | null = eq
    ? eq.slice('--only='.length)
    : at >= 0 && at + 1 < argv.length && !argv[at + 1]!.startsWith('--')
      ? argv[at + 1]!
      : null;
  const onlyGiven = argv.some((a) => a === '--only' || a.startsWith('--only='));
  if (!onlyGiven) {
    const shortcuts = stageIds.filter((id) => argv.includes(`--${id}`));
    if (shortcuts.length > 0) onlyRaw = shortcuts.join(',');
  }
  const only = onlyRaw
    ? new Set(
        onlyRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
    : null;
  const valid = `Valid stages: ${stageIds.join(', ')}`;
  if (onlyGiven && (!only || only.size === 0)) {
    return { kind: 'usage-error', message: `--only names no stage\n${valid}` };
  }
  if (only) {
    const unknown = [...only].filter((s) => !stageIds.includes(s));
    if (unknown.length > 0) {
      return { kind: 'usage-error', message: `Unknown stage(s): ${unknown.join(', ')}\n${valid}` };
    }
  }
  return { kind: 'run', only };
}

async function waitUntilReady(services: readonly LiveService[], waitMs: number): Promise<string[]> {
  const deadline = performance.now() + waitMs;
  for (;;) {
    const answers = await Promise.all(
      services.map(async (s) => ({ name: s.name, why: s.ready ? await s.ready() : null })),
    );
    const pending = answers.filter((a) => a.why !== null);
    if (pending.length === 0) return [];
    if (performance.now() >= deadline) return pending.map((a) => `${a.name}: ${a.why}`);
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
  }
}

function fmtTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
}

function probePort(port: number, host = '127.0.0.1', timeoutMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (ok: boolean): void => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
    sock.connect(port, host);
  });
}

const write = (text: string): void => {
  process.stdout.write(text);
};

class Heartbeat {
  private timer: NodeJS.Timeout | null = null;
  private start = 0;
  private name = '';
  private lineLen = 0;

  constructor(
    private readonly c: Palette,
    private readonly interactive: boolean,
  ) {}

  begin(name: string): void {
    this.name = name;
    this.start = performance.now();
    this.lineLen = 0;
    if (this.interactive) {
      this.paint();
      this.timer = setInterval(() => this.paint(), 1000);
    } else {
      write(`${this.c.CYAN}▶${this.c.RESET} ${name}...\n`);
    }
  }

  end(finalLine: string): void {
    this.clear();
    write(`${finalLine}\n`);
  }

  clear(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.interactive && this.lineLen > 0) write(`\r${' '.repeat(this.lineLen)}\r`);
    this.lineLen = 0;
  }

  private paint(): void {
    const { CYAN, DIM, RESET } = this.c;
    const line = `${CYAN}▶${RESET} ${this.name}... ${DIM}(${fmtTime(performance.now() - this.start)} elapsed)${RESET}`;
    write(`\r${line}${' '.repeat(Math.max(0, this.lineLen - line.length))}`);
    this.lineLen = line.length;
  }
}

function printFailures(c: Palette, failures: readonly TestFailure[]): void {
  const { YELLOW, DIM, RESET } = c;
  for (const f of failures) {
    write(`  ${YELLOW}${f.title}${RESET}\n  ${DIM}${f.file}${RESET}\n`);
    for (const msg of f.messages) {
      write(
        `${DIM}${msg
          .split('\n')
          .map((l) => `    ${l}`)
          .join('\n')}${RESET}\n`,
      );
    }
    write('\n');
  }
}

function printRawTail(
  c: Palette,
  tool: string,
  code: number,
  stdout: string,
  stderr: string,
): void {
  const { DIM, RESET } = c;
  write(
    `${DIM}${tool} exited with code ${code} but the JSON report contains no failures.${RESET}\n`,
  );
  write(`${DIM}Raw stderr (truncated):${RESET}\n${DIM}${stderr.trim().slice(0, 4000)}${RESET}\n`);
  write(
    `${DIM}Raw stdout (truncated, JSON portion likely present):${RESET}\n${DIM}${stdout.trim().slice(0, 4000)}${RESET}\n\n`,
  );
}

function detailOf(totals: Totals, elapsed: number, loadFailures = 0): string {
  const loads = loadFailures
    ? `, ${loadFailures} ${loadFailures === 1 ? 'file' : 'files'} failed to load`
    : '';
  return `${totals.passed} passed${totals.failed ? `, ${totals.failed} failed` : ''}${loads}${totals.skipped ? `, ${totals.skipped} skipped` : ''}${totals.flaky ? `, ${totals.flaky} flaky` : ''} · ${fmtTime(elapsed)}`;
}

export async function runQuietGate(
  config: QuietGateConfig,
  argv: readonly string[] = process.argv.slice(2),
): Promise<never> {
  if (typeof config.logDir !== 'string' || !path.isAbsolute(config.logDir)) {
    const err = paletteFor(process.stderr);
    process.stderr.write(
      `${err.RED}The quiet gate config names no output folder${err.RESET}\n` +
        `logDir must be the absolute path of the folder the gate writes each step's output into; it is ${JSON.stringify(config.logDir)}\n`,
    );
    process.exit(2);
  }
  const c = paletteFor(process.stdout);
  const { RED, GREEN, YELLOW, DIM, BOLD, RESET } = c;
  const stageIds = config.stages.map((s) => s.id);
  const selection = selectStages(
    argv,
    stageIds,
    Object.fromEntries(config.stages.map((s) => [s.id, s.phase])),
  );
  if (selection.kind === 'help') {
    const width = Math.max(...stageIds.map((id) => id.length)) + 4;
    write(
      `\nUsage: node ${config.script} [options]\n\nOptions:\n` +
        `  --phase <phase>   Run every stage of one phase: ${GATE_PHASES.join(', ')}.\n` +
        `  --only <stages>   Comma-separated list of stages to run.\n` +
        `                    Stages: ${stageIds.join(', ')}\n` +
        config.stages.map((s) => `  --${s.id.padEnd(width)}${s.description}\n`).join('') +
        `  -h, --help        Show this help and exit\n\n`,
    );
    process.exit(0);
  }
  if (selection.kind === 'usage-error') {
    const err = paletteFor(process.stderr);
    const [first, ...rest] = selection.message.split('\n');
    process.stderr.write(`${err.RED}${first}${err.RESET}\n${rest.join('\n')}\n`);
    process.exit(2);
  }
  const { only } = selection;

  mkdirSync(config.logDir, { recursive: true });
  const heartbeat = new Heartbeat(c, Boolean(process.stdout.isTTY));
  process.on('SIGINT', () => {
    heartbeat.clear();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    heartbeat.clear();
    process.exit(143);
  });
  process.on('exit', () => heartbeat.clear());

  const results: StepResult[] = [];
  const ok = (name: string, detail: string): void =>
    heartbeat.end(`${GREEN}✓${RESET} ${name} ${DIM}(${detail})${RESET}`);
  const fail = (name: string, detail: string): void =>
    heartbeat.end(`${RED}✖${RESET} ${name} ${DIM}(${detail})${RESET}`);

  const claimedStems = new Map<string, string>();
  function claimFiles(label: string): StepFiles | string {
    const stem = stepFileStem(label);
    if (!stem) return `its label ${JSON.stringify(label)} leaves no file name`;
    const holder = claimedStems.get(stem);
    if (holder !== undefined) {
      return `its output file ${stem}.log is already step ${JSON.stringify(holder)}'s in this run`;
    }
    claimedStems.set(stem, label);
    const files = {
      output: path.join(config.logDir, `${stem}.log`),
      report: path.join(config.logDir, `${stem}.json`),
    };
    rmSync(files.output, { force: true });
    rmSync(files.report, { force: true });
    return files;
  }

  const saveOutput = (files: StepFiles, stdout: string, stderr: string): void =>
    writeFileSync(files.output, outputFileText(stdout, stderr));

  function printWhere(files: StepFiles): void {
    write(`${DIM}Full output: ${files.output}${RESET}\n`);
    if (existsSync(files.report)) write(`${DIM}JSON report: ${files.report}${RESET}\n`);
    write('\n');
  }

  async function commandStep(
    step: Extract<GateStep, { kind: 'command' }>,
    files: StepFiles,
  ): Promise<boolean> {
    heartbeat.begin(step.label);
    const t0 = performance.now();
    const { code, stdout, stderr } = await runCommand(step.command, step.args, { cwd: step.cwd });
    const elapsed = performance.now() - t0;
    saveOutput(files, stdout, stderr);
    if (code === 0) {
      ok(step.label, fmtTime(elapsed));
      results.push({ name: step.label, ok: true });
      return true;
    }
    fail(step.label, fmtTime(elapsed));
    write(`${DIM}${`${stdout}\n${stderr}`.trim().slice(0, 4000)}${RESET}\n`);
    printWhere(files);
    results.push({ name: step.label, ok: false });
    return false;
  }

  async function vitestStep(
    step: Extract<GateStep, { kind: 'vitest' }>,
    files: StepFiles,
  ): Promise<boolean> {
    heartbeat.begin(step.label);
    const t0 = performance.now();
    const { code, stdout, stderr } = await runCommand(
      'npx',
      ['vitest', 'run', '--reporter=json', ...(step.args ?? [])],
      { cwd: step.cwd },
    );
    const elapsed = performance.now() - t0;
    saveOutput(files, stdout, stderr);
    const parsed = parseVitestJson(stdout);
    if (parsed) writeFileSync(files.report, JSON.stringify(parsed, null, 2));
    const { failures, suiteFailures, totals, skippedTests } = collectVitestFailures(parsed);
    if (!totals) {
      fail(step.label, fmtTime(elapsed));
      write(`${DIM}Could not parse vitest JSON output.${RESET}\n`);
      write(`${DIM}${`${stdout}\n${stderr}`.trim().slice(0, 4000)}${RESET}\n`);
      printWhere(files);
      results.push({ name: step.label, ok: false, totals: null });
      return false;
    }
    const verdict = vitestStageVerdict({ code, totals, suiteFailures });
    const detail = detailOf(totals, elapsed, suiteFailures.length);
    if (verdict.ok) {
      ok(step.label, detail);
      results.push({ name: step.label, ok: true, totals });
      return true;
    }
    fail(step.label, detail);
    if (verdict.skippedReason) {
      write(`${YELLOW}${verdict.skippedReason}${RESET}\n`);
      for (const s of skippedTests) {
        write(
          `  ${YELLOW}${s.title}${RESET} ${DIM}(${s.status})${RESET}\n  ${DIM}${s.file}${RESET}\n`,
        );
      }
      write('\n');
    }
    if (suiteFailures.length > 0) {
      write(`${YELLOW}${formatSuiteFailures(suiteFailures)}${RESET}\n\n`);
    }
    if (failures.length === 0 && suiteFailures.length === 0 && code !== 0) {
      // The JSON reporter records an unhandled error against no test.
      const unhandled = formatUnhandledErrorReport(`${stderr}\n${stdout}`);
      if (unhandled) write(`${YELLOW}${unhandled}${RESET}\n\n`);
      printRawTail(c, 'Vitest', code, stdout, stderr);
    }
    printFailures(c, failures);
    printWhere(files);
    results.push({ name: step.label, ok: false, totals });
    return false;
  }

  async function playwrightStep(
    step: Extract<GateStep, { kind: 'playwright' }>,
    files: StepFiles,
  ): Promise<boolean> {
    for (const target of step.clearBeforeRun ?? []) {
      rmSync(path.join(step.cwd, target), { recursive: true, force: true });
    }
    heartbeat.begin(step.label);
    const t0 = performance.now();
    const { code, stdout, stderr } = await runCommand(
      'npx',
      ['playwright', 'test', '--reporter=json'],
      {
        cwd: step.cwd,
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: files.report },
      },
    );
    const elapsed = performance.now() - t0;
    saveOutput(files, stdout, stderr);
    const reportWritten = existsSync(files.report);
    const report = ((): PlaywrightJsonReport | null => {
      try {
        return JSON.parse(
          reportWritten ? readFileSync(files.report, 'utf8') : stdout.trim(),
        ) as PlaywrightJsonReport;
      } catch {
        return null;
      }
    })();
    if (report && !reportWritten) writeFileSync(files.report, JSON.stringify(report, null, 2));
    if (!report) {
      fail(step.label, fmtTime(elapsed));
      write(`${DIM}Could not parse playwright JSON output.${RESET}\n`);
      write(`${DIM}${`${stdout}\n${stderr}`.trim().slice(0, 4000)}${RESET}\n`);
      printWhere(files);
      results.push({ name: step.label, ok: false });
      return false;
    }
    const { failures, flakyTests, totals } = collectPlaywrightFailures(report);
    appendFlakyLog(c, path.join(step.cwd, step.flakyLogPath), flakyTests);
    const green = code === 0 && totals.failed === 0 && totals.flaky === 0 && totals.skipped === 0;
    const detail = detailOf(totals, elapsed);
    if (green) {
      ok(step.label, detail);
      results.push({ name: step.label, ok: true, totals });
      return true;
    }
    fail(step.label, detail);
    if (totals.skipped > 0) {
      write(`${DIM}${totals.skipped} skipped test(s) make this stage non-green.${RESET}\n`);
    }
    if (failures.length === 0 && code !== 0) printRawTail(c, 'Playwright', code, stdout, stderr);
    printFailures(c, failures);
    for (const flaky of flakyTests) {
      write(`  ${YELLOW}retry-pass: ${flaky.title}${RESET}\n  ${DIM}${flaky.file}${RESET}\n`);
      write(
        `  ${DIM}Passed only after retry; the zero-flake gate requires a fix before handoff.${RESET}\n\n`,
      );
    }
    printWhere(files);
    results.push({ name: step.label, ok: false, totals: totals as PlaywrightTotals });
    return false;
  }

  const runStep = async (step: GateStep): Promise<boolean> => {
    const files = claimFiles(step.label);
    if (typeof files === 'string') {
      write(`${RED}✖${RESET} ${step.label} ${DIM}(not run: ${files})${RESET}\n`);
      results.push({ name: step.label, ok: false });
      return false;
    }
    return step.kind === 'command'
      ? commandStep(step, files)
      : step.kind === 'vitest'
        ? vitestStep(step, files)
        : playwrightStep(step, files);
  };

  const overallStart = performance.now();
  write(
    only
      ? `${BOLD}Running ${config.title}${RESET} ${DIM}(only: ${[...only].join(', ')})${RESET}\n\n`
      : `${BOLD}Running ${config.title}${RESET}\n\n`,
  );

  stages: for (const stage of config.stages) {
    if (only && !only.has(stage.id)) continue;
    const steps = stage.steps();
    if (stage.services?.length) {
      const probes = await Promise.all(
        stage.services.map((s) => probePort(s.port).then((up) => ({ ...s, up }))),
      );
      const down = probes.filter((p) => !p.up).map((p) => p.name);
      if (down.length > 0) {
        for (const step of steps) {
          if (only?.has(stage.id)) {
            write(
              `${RED}✖${RESET} ${step.label} ${DIM}(local services not running: ${down.join(', ')})${RESET}\n`,
            );
            write(`${DIM}  ${stage.startHint ?? 'start the local stack'}, then rerun${RESET}\n`);
            results.push({ name: step.label, ok: false });
          } else {
            write(
              `${YELLOW}⊘${RESET} ${step.label} ${DIM}(skipped — local services not running: ${down.join(', ')})${RESET}\n`,
            );
            results.push({ name: step.label, skipped: true });
          }
        }
        continue;
      }
      if (stage.services.some((s) => s.ready)) {
        heartbeat.begin(`waiting for ${stage.id}'s local services to be ready`);
        const notReady = await waitUntilReady(stage.services, stage.readyWaitMs ?? READY_WAIT_MS);
        heartbeat.clear();
        if (notReady.length > 0) {
          for (const step of steps) {
            write(
              `${RED}✖${RESET} ${step.label} ${DIM}(local services not ready: ${notReady.join('; ')})${RESET}
`,
            );
            results.push({ name: step.label, ok: false });
          }
          continue;
        }
      }
    }
    for (const step of steps) {
      const passed = await runStep(step);
      if (!passed && stage.stopOnFailure) break stages;
    }
  }

  return finish(c, results, performance.now() - overallStart, config.logDir);
}

function appendFlakyLog(c: Palette, logPath: string, flakyTests: readonly FlakyTest[]): void {
  const { YELLOW, DIM, RESET } = c;
  if (flakyTests.length === 0) return;
  try {
    if (!existsSync(logPath)) writeFileSync(logPath, FLAKY_LOG_HEADER);
    appendFileSync(logPath, `${flakyLogRows(flakyTests, new Date())}\n`);
    write(`${YELLOW}⚑${RESET} ${flakyTests.length} retry-pass(es) appended to ${logPath}\n`);
  } catch (error) {
    write(
      `${DIM}Could not append to ${logPath}: ${error instanceof Error ? error.message : String(error)}${RESET}\n`,
    );
  }
}

function finish(c: Palette, results: readonly StepResult[], total: number, logDir: string): never {
  const { RED, GREEN, YELLOW, DIM, BOLD, RESET } = c;
  const failed = results.filter((r) => r.ok === false);
  const skipped = results.filter((r) => r.skipped);
  write(`\n${BOLD}Summary${RESET} ${DIM}(${fmtTime(total)})${RESET}\n`);
  for (const r of results) {
    if (r.skipped) {
      write(`  ${YELLOW}⊘${RESET} ${r.name} ${DIM}(skipped)${RESET}\n`);
      continue;
    }
    const t = r.totals;
    const counts = t
      ? `${t.passed} passed${t.failed || !r.ok ? `, ${t.failed} failed` : ''}${t.skipped ? `, ${t.skipped} skipped` : ''}${t.flaky ? `, ${t.flaky} flaky` : ''}`
      : r.ok
        ? 'ok'
        : 'failed';
    write(`  ${r.ok ? `${GREEN}✓` : `${RED}✖`}${RESET} ${r.name} ${DIM}(${counts})${RESET}\n`);
  }
  if (results.length > 0) write(`\n${DIM}Each step's full output: ${logDir}${RESET}\n`);
  if (failed.length > 0) {
    write(
      `\n${RED}${BOLD}${failed.length} stage${failed.length === 1 ? '' : 's'} failed${RESET}\n`,
    );
    process.exit(1);
  }
  if (results.length === 0) {
    write(`\n${YELLOW}${BOLD}No stages ran${RESET}\n`);
    process.exit(0);
  }
  if (skipped.length > 0) {
    write(
      `\n${YELLOW}${BOLD}All run stages passed${RESET} ${DIM}(${skipped.length} skipped)${RESET}\n`,
    );
    process.exit(0);
  }
  write(`\n${GREEN}${BOLD}All stages passed${RESET}\n`);
  process.exit(0);
}
