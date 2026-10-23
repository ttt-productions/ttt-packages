#!/usr/bin/env node
import { spawn } from 'child_process';
import { performance } from 'perf_hooks';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const argv = process.argv.slice(2);

function hasFlag(...names) {
  return names.some((n) => argv.includes(n));
}

function flagValue(name) {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  if (i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
    return argv[i + 1];
  }
  return null;
}

if (hasFlag('--help', '-h')) {
  process.stdout.write(`
Usage: node test-quiet.mjs [options]

Quiet pre-commit / pre-publish gate. Runs the test:all stages, then a final schema check
(auto-regenerating the generated schema docs if they are stale). Concise, one line per stage.

Options:
  --only <stages>   Comma-separated list of stages to run.
                    Stages: audit, lint, format, typecheck, tscb, build, test, schema
  --test            Shortcut for --only test
  --build           Shortcut for --only build
  --audit           Shortcut for --only audit (mirrors the publish CI security gate)
  --lint            Shortcut for --only lint
  --format          Shortcut for --only format
  --typecheck       Shortcut for --only typecheck
  --tscb            Shortcut for --only tscb
  --schema          Shortcut for --only schema
  --format-check-only
                    The format stage only checks (prettier --check) and never writes —
                    the release preflight's form, so a release never publishes
                    formatting nobody committed
  -h, --help        Show this help and exit

Examples:
  node test-quiet.mjs
  node test-quiet.mjs --only test
  node test-quiet.mjs --only build,test
  node test-quiet.mjs --schema
`);
  process.exit(0);
}

let onlyRaw = flagValue('--only');
if (!onlyRaw) {
  const aliases = [];
  if (hasFlag('--audit')) aliases.push('audit');
  if (hasFlag('--lint')) aliases.push('lint');
  if (hasFlag('--format')) aliases.push('format');
  if (hasFlag('--typecheck')) aliases.push('typecheck');
  if (hasFlag('--tscb')) aliases.push('tscb');
  if (hasFlag('--build')) aliases.push('build');
  if (hasFlag('--test')) aliases.push('test');
  if (hasFlag('--schema')) aliases.push('schema');
  if (aliases.length > 0) onlyRaw = aliases.join(',');
}

const KNOWN_STAGES = new Set([
  'audit',
  'lint',
  'format',
  'typecheck',
  'tscb',
  'build',
  'test',
  'schema',
]);
const only = onlyRaw
  ? new Set(
      onlyRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
  : null;

if (only) {
  const unknown = [...only].filter((s) => !KNOWN_STAGES.has(s));
  if (unknown.length > 0) {
    process.stderr.write(
      `${RED}Unknown stage(s): ${unknown.join(', ')}${RESET}\n` +
        `Valid stages: ${[...KNOWN_STAGES].join(', ')}\n`,
    );
    process.exit(2);
  }
}

function shouldRun(stage) {
  return !only || only.has(stage);
}

function fmtTime(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m${s}s`;
}

// The build stage chains every package build with `&&`, so the real error is at the tail.
function tail(s, n) {
  if (s.length <= n) return s;
  return `${DIM}…(${s.length - n} earlier chars truncated)…${RESET}\n` + s.slice(s.length - n);
}

// Windows `npm` / `npx` are `.cmd` shims Node spawns only through a shell, and Node deprecates an
// args array with a shell, so runCmd joins the command line itself.
const SHELL_SAFE_TOKEN = /^[\w@+=:,./-]+$/;

function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const unsafe = [cmd, ...args].find((token) => !SHELL_SAFE_TOKEN.test(token));
    if (unsafe !== undefined) {
      resolve({
        code: 1,
        stdout: '',
        stderr: `Refusing to run: ${JSON.stringify(unsafe)} is not a shell-safe token.`,
      });
      return;
    }
    const child = spawn([cmd, ...args].join(' '), { shell: true, ...opts });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('close', (code, signal) => resolve({ code: code ?? 1, signal, stdout, stderr }));
    child.on('error', (err) => resolve({ code: 1, stdout, stderr: stderr + '\n' + err.message }));
  });
}

let heartbeatTimer = null;
let heartbeatStart = 0;
let heartbeatName = '';
let heartbeatLineLen = 0;

const HEARTBEAT_INTERACTIVE = !!process.stdout.isTTY;

function paintHeartbeat() {
  if (!HEARTBEAT_INTERACTIVE) return;
  const elapsed = performance.now() - heartbeatStart;
  const line = `${CYAN}▶${RESET} ${heartbeatName}... ${DIM}(${fmtTime(elapsed)} elapsed)${RESET}`;
  const pad = Math.max(0, heartbeatLineLen - line.length);
  process.stdout.write('\r' + line + ' '.repeat(pad));
  heartbeatLineLen = line.length;
}

function startHeartbeat(name) {
  heartbeatName = name;
  heartbeatStart = performance.now();
  heartbeatLineLen = 0;
  if (HEARTBEAT_INTERACTIVE) {
    paintHeartbeat();
    heartbeatTimer = setInterval(paintHeartbeat, 1000);
  } else {
    process.stdout.write(`${CYAN}▶${RESET} ${name}...\n`);
  }
}

function stopHeartbeatAndPrint(finalLine) {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (HEARTBEAT_INTERACTIVE) {
    const blank = ' '.repeat(Math.max(heartbeatLineLen, 0));
    process.stdout.write('\r' + blank + '\r');
    process.stdout.write(finalLine + '\n');
  } else {
    process.stdout.write(finalLine + '\n');
  }
  heartbeatLineLen = 0;
}

function printStart(name) {
  startHeartbeat(name);
}
function printOk(name, detail) {
  stopHeartbeatAndPrint(`${GREEN}✓${RESET} ${name}${detail ? ` ${DIM}(${detail})${RESET}` : ''}`);
}
function printFail(name, detail) {
  stopHeartbeatAndPrint(`${RED}✖${RESET} ${name}${detail ? ` ${DIM}(${detail})${RESET}` : ''}`);
}

function cleanupHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (HEARTBEAT_INTERACTIVE && heartbeatLineLen > 0) {
    process.stdout.write('\r' + ' '.repeat(heartbeatLineLen) + '\r');
  }
}
process.on('SIGINT', () => {
  cleanupHeartbeat();
  process.exit(130);
});
process.on('SIGTERM', () => {
  cleanupHeartbeat();
  process.exit(143);
});
process.on('exit', cleanupHeartbeat);

const results = [];
function record(r) {
  results.push(r);
}

function parseVitestJson(stdout) {
  const trimmed = stdout.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) return null;
  try {
    return JSON.parse(trimmed.slice(first, last + 1));
  } catch {
    return null;
  }
}

function collectVitestFailures(report) {
  if (!report) return { failures: [], totals: null };
  const totals = {
    passed: report.numPassedTests ?? 0,
    failed: report.numFailedTests ?? 0,
    skipped: report.numPendingTests ?? 0,
    total: report.numTotalTests ?? 0,
  };
  const failures = [];
  for (const file of report.testResults ?? []) {
    for (const a of file.assertionResults ?? []) {
      if (a.status === 'failed') {
        failures.push({
          file: file.name,
          title: a.fullName || a.title,
          messages: a.failureMessages ?? [],
        });
      }
    }
  }
  return { failures, totals };
}

async function stagePlain(name, cmd, args, cwd) {
  printStart(name);
  const t0 = performance.now();
  const { code, stdout, stderr } = await runCmd(cmd, args, { cwd });
  const elapsed = performance.now() - t0;
  if (code === 0) {
    printOk(name, fmtTime(elapsed));
    record({ name, ok: true, elapsed });
    return true;
  }
  printFail(name, fmtTime(elapsed));
  const blob = (stdout + '\n' + stderr).trim();
  process.stdout.write(`${DIM}${tail(blob, 16000)}${RESET}\n\n`);
  record({ name, ok: false, elapsed, errorBlob: blob });
  return false;
}

async function stageVitest(name, extraArgs, cwd) {
  printStart(name);
  const t0 = performance.now();
  // Only through the root `test` script: it alone chooses the threads pool.
  const { code, signal, stdout, stderr } = await runCmd(
    'npm',
    ['run', '--silent', 'test', '--', '--reporter=json', ...extraArgs],
    { cwd },
  );
  const elapsed = performance.now() - t0;
  const parsed = parseVitestJson(stdout);
  const { failures, totals } = collectVitestFailures(parsed);

  if (!totals) {
    printFail(name, fmtTime(elapsed));
    process.stdout.write(
      `${DIM}Could not parse vitest JSON output (exit code ${code}${signal ? `, signal ${signal}` : ''}, ${stdout.length} bytes on stdout).${RESET}\n`,
    );
    const blob = (stdout + '\n' + stderr).trim();
    process.stdout.write(`${DIM}${tail(blob, 16000)}${RESET}\n\n`);
    record({ name, ok: false, elapsed, errorBlob: blob, totals: null });
    return false;
  }

  const ok = code === 0 && totals.failed === 0;
  const detail = `${totals.passed} passed${totals.failed ? `, ${totals.failed} failed` : ''}${totals.skipped ? `, ${totals.skipped} skipped` : ''} · ${fmtTime(elapsed)}`;

  if (ok) {
    printOk(name, detail);
    record({ name, ok: true, elapsed, totals });
    return true;
  }

  printFail(name, detail);
  if (failures.length === 0 && code !== 0) {
    process.stdout.write(
      `${DIM}Vitest exited with code ${code} but the JSON report contains no failures.${RESET}\n`,
    );
    process.stdout.write(`${DIM}Raw stderr (tail):${RESET}\n`);
    process.stdout.write(`${DIM}${tail((stderr || '').trim(), 16000)}${RESET}\n`);
    process.stdout.write(`${DIM}Raw stdout (tail):${RESET}\n`);
    process.stdout.write(`${DIM}${tail((stdout || '').trim(), 16000)}${RESET}\n\n`);
  }
  for (const f of failures) {
    process.stdout.write(`  ${YELLOW}${f.title}${RESET}\n`);
    process.stdout.write(`  ${DIM}${f.file}${RESET}\n`);
    for (const msg of f.messages) {
      const lines = msg
        .split('\n')
        .map((l) => `    ${l}`)
        .join('\n');
      process.stdout.write(`${DIM}${lines}${RESET}\n`);
    }
    process.stdout.write('\n');
  }
  record({ name, ok: false, elapsed, totals, failures });
  return false;
}

// Needs ttt-core's dist, which the build stage produces.
async function stageSchema(name, root) {
  printStart(name);
  const t0 = performance.now();
  const check = await runCmd('node', ['scripts/generate-schema-docs.mjs', '--check'], {
    cwd: root,
  });
  if (check.code === 0) {
    const elapsed = performance.now() - t0;
    printOk(name, `up to date · ${fmtTime(elapsed)}`);
    record({ name, ok: true, elapsed });
    return true;
  }
  const regen = await runCmd('node', ['scripts/generate-schema-docs.mjs'], { cwd: root });
  const elapsed = performance.now() - t0;
  if (regen.code === 0) {
    stopHeartbeatAndPrint(
      `${YELLOW}✓${RESET} ${name} ${DIM}(check failed — regenerated docs; commit docs/generated/firestore-schema.{md,mmd}) · ${fmtTime(elapsed)}${RESET}`,
    );
    record({ name, ok: true, regenerated: true, elapsed });
    return true;
  }
  printFail(name, fmtTime(elapsed));
  const blob = (regen.stdout + '\n' + regen.stderr).trim();
  process.stdout.write(`${DIM}${tail(blob, 16000)}${RESET}\n\n`);
  record({ name, ok: false, elapsed, errorBlob: blob });
  return false;
}

(async function main() {
  const overallStart = performance.now();
  const root = process.cwd();

  const header = only
    ? `${BOLD}Running quiet test suite${RESET} ${DIM}(only: ${[...only].join(', ')})${RESET}\n\n`
    : `${BOLD}Running quiet test suite${RESET}\n\n`;
  process.stdout.write(header);

  // The publish workflow's audit command, verbatim.
  if (shouldRun('audit')) {
    if (
      !(await stagePlain(
        'audit (prod deps, high)',
        'npm',
        ['audit', '--omit=dev', '--audit-level=high'],
        root,
      ))
    )
      return finish(overallStart);
  }
  if (shouldRun('lint')) {
    if (!(await stagePlain('lint', 'npm', ['run', 'lint'], root))) return finish(overallStart);
  }
  if (shouldRun('format')) {
    if (hasFlag('--format-check-only')) {
      if (!(await stagePlain('format (prettier --check)', 'npm', ['run', 'format:check'], root)))
        return finish(overallStart);
    } else {
      if (!(await stagePlain('format (prettier --write)', 'npm', ['run', 'format'], root)))
        return finish(overallStart);
      if (!(await stagePlain('format (prettier --check)', 'npm', ['run', 'format:check'], root)))
        return finish(overallStart);
    }
  }
  // Before the type checks, which resolve @ttt-productions/* through dist (preflight wipes it).
  if (shouldRun('build')) {
    if (!(await stagePlain('build (all packages)', 'npm', ['run', 'build'], root)))
      return finish(overallStart);
  }
  if (shouldRun('typecheck')) {
    if (!(await stagePlain('typecheck', 'npm', ['run', 'typecheck'], root)))
      return finish(overallStart);
  }
  if (shouldRun('tscb')) {
    if (!(await stagePlain('tsc -b --noEmit', 'npx', ['tsc', '-b', '--noEmit'], root)))
      return finish(overallStart);
  }
  if (shouldRun('test')) {
    if (!(await stageVitest('vitest', [], root))) return finish(overallStart);
  }
  if (shouldRun('schema')) {
    await stageSchema('schema', root);
  }

  return finish(overallStart);
})();

function finish(overallStart) {
  const total = performance.now() - overallStart;
  const failed = results.filter((r) => r.ok === false);
  const regenerated = results.some((r) => r.regenerated);

  process.stdout.write(`\n${BOLD}Summary${RESET} ${DIM}(${fmtTime(total)})${RESET}\n`);
  for (const r of results) {
    if (r.ok && r.regenerated) {
      process.stdout.write(
        `  ${YELLOW}✓${RESET} ${r.name} ${DIM}(check failed — regenerated; commit the docs)${RESET}\n`,
      );
    } else if (r.ok) {
      const t = r.totals
        ? `${r.totals.passed} passed${r.totals.failed ? `, ${r.totals.failed} failed` : ''}${r.totals.skipped ? `, ${r.totals.skipped} skipped` : ''}`
        : 'ok';
      process.stdout.write(`  ${GREEN}✓${RESET} ${r.name} ${DIM}(${t})${RESET}\n`);
    } else {
      const t = r.totals
        ? `${r.totals.passed} passed, ${r.totals.failed} failed${r.totals.skipped ? `, ${r.totals.skipped} skipped` : ''}`
        : 'failed';
      process.stdout.write(`  ${RED}✖${RESET} ${r.name} ${DIM}(${t})${RESET}\n`);
    }
  }

  if (results.length === 0) {
    process.stdout.write(
      `\n${YELLOW}${BOLD}No stages ran${RESET} ${DIM}(check your --only value)${RESET}\n`,
    );
    process.exit(0);
  } else if (failed.length > 0) {
    process.stdout.write(
      `\n${RED}${BOLD}${failed.length} stage${failed.length === 1 ? '' : 's'} failed${RESET}\n`,
    );
    process.exit(1);
  } else if (regenerated) {
    process.stdout.write(
      `\n${GREEN}${BOLD}All stages passed${RESET} ${YELLOW}— schema docs were stale and have been regenerated; commit docs/generated/firestore-schema.{md,mmd} before publishing.${RESET}\n`,
    );
    process.exit(0);
  } else {
    process.stdout.write(`\n${GREEN}${BOLD}All stages passed${RESET}\n`);
    process.exit(0);
  }
}
