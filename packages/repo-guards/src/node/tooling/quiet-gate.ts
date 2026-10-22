import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import net from 'node:net';
import os from 'node:os';
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
}

export interface GateStage {
  id: string;
  description: string;
  stopOnFailure: boolean;
  steps: () => readonly GateStep[];
  services?: readonly LiveService[];
  startHint?: string;
}

export interface QuietGateConfig {
  title: string;
  script: string;
  stages: readonly GateStage[];
}

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

type Totals = { passed: number; failed: number; skipped: number; flaky?: number };
type StepResult = { name: string; ok?: boolean; skipped?: boolean; totals?: Totals | null };

export type GateSelection =
  | { kind: 'help' }
  | { kind: 'usage-error'; message: string }
  | { kind: 'run'; only: ReadonlySet<string> | null };

export function selectStages(argv: readonly string[], stageIds: readonly string[]): GateSelection {
  if (argv.includes('--help') || argv.includes('-h')) return { kind: 'help' };
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
  private readonly interactive = Boolean(process.stdout.isTTY);

  begin(name: string): void {
    this.name = name;
    this.start = performance.now();
    this.lineLen = 0;
    if (this.interactive) {
      this.paint();
      this.timer = setInterval(() => this.paint(), 1000);
    } else {
      write(`${CYAN}▶${RESET} ${name}...\n`);
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
    const line = `${CYAN}▶${RESET} ${this.name}... ${DIM}(${fmtTime(performance.now() - this.start)} elapsed)${RESET}`;
    write(`\r${line}${' '.repeat(Math.max(0, this.lineLen - line.length))}`);
    this.lineLen = line.length;
  }
}

function printFailures(failures: readonly TestFailure[]): void {
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

function printRawTail(tool: string, code: number, stdout: string, stderr: string): void {
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
  const stageIds = config.stages.map((s) => s.id);
  const selection = selectStages(argv, stageIds);
  if (selection.kind === 'help') {
    const width = Math.max(...stageIds.map((id) => id.length)) + 4;
    write(
      `\nUsage: node ${config.script} [options]\n\nOptions:\n` +
        `  --only <stages>   Comma-separated list of stages to run.\n` +
        `                    Stages: ${stageIds.join(', ')}\n` +
        config.stages.map((s) => `  --${s.id.padEnd(width)}${s.description}\n`).join('') +
        `  -h, --help        Show this help and exit\n\n`,
    );
    process.exit(0);
  }
  if (selection.kind === 'usage-error') {
    const [first, ...rest] = selection.message.split('\n');
    process.stderr.write(`${RED}${first}${RESET}\n${rest.join('\n')}\n`);
    process.exit(2);
  }
  const { only } = selection;

  const heartbeat = new Heartbeat();
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

  async function commandStep(step: Extract<GateStep, { kind: 'command' }>): Promise<boolean> {
    heartbeat.begin(step.label);
    const t0 = performance.now();
    const { code, stdout, stderr } = await runCommand(step.command, step.args, { cwd: step.cwd });
    const elapsed = performance.now() - t0;
    if (code === 0) {
      ok(step.label, fmtTime(elapsed));
      results.push({ name: step.label, ok: true });
      return true;
    }
    fail(step.label, fmtTime(elapsed));
    write(`${DIM}${`${stdout}\n${stderr}`.trim().slice(0, 4000)}${RESET}\n\n`);
    results.push({ name: step.label, ok: false });
    return false;
  }

  async function vitestStep(step: Extract<GateStep, { kind: 'vitest' }>): Promise<boolean> {
    heartbeat.begin(step.label);
    const t0 = performance.now();
    const { code, stdout, stderr } = await runCommand(
      'npx',
      ['vitest', 'run', '--reporter=json', ...(step.args ?? [])],
      { cwd: step.cwd },
    );
    const elapsed = performance.now() - t0;
    const { failures, suiteFailures, totals, skippedTests } = collectVitestFailures(
      parseVitestJson(stdout),
    );
    if (!totals) {
      fail(step.label, fmtTime(elapsed));
      write(`${DIM}Could not parse vitest JSON output.${RESET}\n`);
      write(`${DIM}${`${stdout}\n${stderr}`.trim().slice(0, 4000)}${RESET}\n\n`);
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
      printRawTail('Vitest', code, stdout, stderr);
    }
    printFailures(failures);
    results.push({ name: step.label, ok: false, totals });
    return false;
  }

  async function playwrightStep(step: Extract<GateStep, { kind: 'playwright' }>): Promise<boolean> {
    for (const target of step.clearBeforeRun ?? []) {
      rmSync(path.join(step.cwd, target), { recursive: true, force: true });
    }
    heartbeat.begin(step.label);
    const t0 = performance.now();
    const reportDir = mkdtempSync(path.join(os.tmpdir(), 'pw-quiet-'));
    const reportPath = path.join(reportDir, 'report.json');
    const { code, stdout, stderr } = await runCommand(
      'npx',
      ['playwright', 'test', '--reporter=json'],
      {
        cwd: step.cwd,
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath },
      },
    );
    const elapsed = performance.now() - t0;
    const report = ((): PlaywrightJsonReport | null => {
      try {
        return JSON.parse(
          existsSync(reportPath) ? readFileSync(reportPath, 'utf8') : stdout.trim(),
        ) as PlaywrightJsonReport;
      } catch {
        return null;
      }
    })();
    rmSync(reportDir, { recursive: true, force: true });
    if (!report) {
      fail(step.label, fmtTime(elapsed));
      write(`${DIM}Could not parse playwright JSON output.${RESET}\n`);
      write(`${DIM}${`${stdout}\n${stderr}`.trim().slice(0, 4000)}${RESET}\n\n`);
      results.push({ name: step.label, ok: false });
      return false;
    }
    const { failures, flakyTests, totals } = collectPlaywrightFailures(report);
    appendFlakyLog(path.join(step.cwd, step.flakyLogPath), flakyTests);
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
    if (failures.length === 0 && code !== 0) printRawTail('Playwright', code, stdout, stderr);
    printFailures(failures);
    for (const flaky of flakyTests) {
      write(`  ${YELLOW}retry-pass: ${flaky.title}${RESET}\n  ${DIM}${flaky.file}${RESET}\n`);
      write(
        `  ${DIM}Passed only after retry; the zero-flake gate requires a fix before handoff.${RESET}\n\n`,
      );
    }
    results.push({ name: step.label, ok: false, totals: totals as PlaywrightTotals });
    return false;
  }

  const runStep = (step: GateStep): Promise<boolean> =>
    step.kind === 'command'
      ? commandStep(step)
      : step.kind === 'vitest'
        ? vitestStep(step)
        : playwrightStep(step);

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
    }
    for (const step of steps) {
      const passed = await runStep(step);
      if (!passed && stage.stopOnFailure) break stages;
    }
  }

  return finish(results, performance.now() - overallStart);
}

function appendFlakyLog(logPath: string, flakyTests: readonly FlakyTest[]): void {
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

function finish(results: readonly StepResult[], total: number): never {
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
