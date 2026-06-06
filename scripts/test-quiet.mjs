#!/usr/bin/env node
/* eslint-disable no-console */
// Quiet pre-commit / pre-publish gate for ttt-packages. Runs the canonical `test:all` stages —
// lint -> typecheck -> `tsc -b --noEmit` -> build (all 22, topo order) -> `vitest run` — and then,
// ONLY if every one of those passed, a final `schema` stage that checks the generated Firestore
// schema docs are in sync and AUTO-REGENERATES them if they are stale.
//
// Output is deliberately minimal: one line per stage. On failure it shows ONLY the failing output
// (the failing tests for vitest, the error tail for plain stages) — never the full multi-thousand-line
// passing log. Stop-on-fail throughout, so a test failure short-circuits before the schema stage.
//
// Exit codes: 0 if everything passed — including when the schema docs were stale and got regenerated
// (commit the regenerated files before publishing); non-zero if any stage failed, including if the
// schema regeneration itself errored. This is the single command to run before committing + publishing.
// It equals the release preflight minus its clean-room reinstall (which the release scripts still do).
import { spawn } from 'child_process';
import { performance } from 'perf_hooks';

// ---------- ANSI ----------
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

// ---------- CLI flags ----------
// Supported usage:
//   node test-quiet.mjs                       # run everything (default)
//   node test-quiet.mjs --only test           # run only the vitest stage
//   node test-quiet.mjs --only=test           # same, equals form
//   node test-quiet.mjs --only build,test     # comma-separated list
//   node test-quiet.mjs --schema              # short alias for --only schema
//   node test-quiet.mjs --help                # print usage and exit
//
// Stage keys accepted by --only:
//   lint       -> npm run lint            (eslint, all workspaces)
//   typecheck  -> npm run typecheck       (per-workspace tsc --noEmit; skips __tests__)
//   tscb       -> npx tsc -b --noEmit     (project refs; the ONLY step that type-checks __tests__)
//   build      -> npm run build           (all 22 packages, topo order)
//   test       -> npx vitest run          (the test suite)
//   schema     -> generate-schema-docs.mjs --check, auto-regenerating the docs if they are stale
const argv = process.argv.slice(2);

function hasFlag(...names) {
    return names.some((n) => argv.includes(n));
}

function flagValue(name) {
    // Support both `--only value` and `--only=value` forms.
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
                    Stages: lint, typecheck, tscb, build, test, schema
  --test            Shortcut for --only test
  --build           Shortcut for --only build
  --lint            Shortcut for --only lint
  --typecheck       Shortcut for --only typecheck
  --tscb            Shortcut for --only tscb
  --schema          Shortcut for --only schema
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
    // Short aliases — mutually inclusive (you can pass --build --test)
    const aliases = [];
    if (hasFlag('--lint')) aliases.push('lint');
    if (hasFlag('--typecheck')) aliases.push('typecheck');
    if (hasFlag('--tscb')) aliases.push('tscb');
    if (hasFlag('--build')) aliases.push('build');
    if (hasFlag('--test')) aliases.push('test');
    if (hasFlag('--schema')) aliases.push('schema');
    if (aliases.length > 0) onlyRaw = aliases.join(',');
}

const KNOWN_STAGES = new Set(['lint', 'typecheck', 'tscb', 'build', 'test', 'schema']);
const only = onlyRaw
    ? new Set(
        onlyRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
    )
    : null;

if (only) {
    const unknown = [...only].filter((s) => !KNOWN_STAGES.has(s));
    if (unknown.length > 0) {
        process.stderr.write(
            `${RED}Unknown stage(s): ${unknown.join(', ')}${RESET}\n` +
            `Valid stages: ${[...KNOWN_STAGES].join(', ')}\n`
        );
        process.exit(2);
    }
}

function shouldRun(stage) {
    return !only || only.has(stage);
}

// ---------- helpers ----------
function fmtTime(ms) {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}m${s}s`;
}

// On failure we show the TAIL of the combined output, not the head: the build stage chains 22
// packages with `&&`, so the real error is at the end. Head-truncation would hide it.
function tail(s, n) {
    if (s.length <= n) return s;
    return `${DIM}…(${s.length - n} earlier chars truncated)…${RESET}\n` + s.slice(s.length - n);
}

function runCmd(cmd, args, opts = {}) {
    return new Promise((resolve) => {
        const child = spawn(cmd, args, { shell: true, ...opts });
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (d) => { stdout += d.toString(); });
        child.stderr?.on('data', (d) => { stderr += d.toString(); });
        child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
        child.on('error', (err) => resolve({ code: 1, stdout, stderr: stderr + '\n' + err.message }));
    });
}

// Heartbeat state: while a stage is running, overwrite a single line every second with elapsed time,
// so the user knows the process is alive. When the stage finishes, clear that line and write the
// final result in its place.
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

function printStart(name) { startHeartbeat(name); }
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
process.on('SIGINT', () => { cleanupHeartbeat(); process.exit(130); });
process.on('SIGTERM', () => { cleanupHeartbeat(); process.exit(143); });
process.on('exit', cleanupHeartbeat);

// ---------- result aggregation ----------
const results = [];
function record(r) { results.push(r); }

// ---------- vitest JSON parsing ----------
function parseVitestJson(stdout) {
    const trimmed = stdout.trim();
    try { return JSON.parse(trimmed); } catch { /* fall through */ }
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first === -1 || last === -1 || last < first) return null;
    try { return JSON.parse(trimmed.slice(first, last + 1)); } catch { return null; }
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

// ---------- stage runners ----------
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
    process.stdout.write(`${DIM}${tail(blob, 6000)}${RESET}\n\n`);
    record({ name, ok: false, elapsed, errorBlob: blob });
    return false;
}

async function stageVitest(name, extraArgs, cwd) {
    printStart(name);
    const t0 = performance.now();
    const { code, stdout, stderr } = await runCmd(
        'npx',
        ['vitest', 'run', '--reporter=json', ...extraArgs],
        { cwd }
    );
    const elapsed = performance.now() - t0;
    const parsed = parseVitestJson(stdout);
    const { failures, totals } = collectVitestFailures(parsed);

    if (!totals) {
        printFail(name, fmtTime(elapsed));
        process.stdout.write(`${DIM}Could not parse vitest JSON output.${RESET}\n`);
        const blob = (stdout + '\n' + stderr).trim();
        process.stdout.write(`${DIM}${tail(blob, 6000)}${RESET}\n\n`);
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
        process.stdout.write(`${DIM}Vitest exited with code ${code} but the JSON report contains no failures.${RESET}\n`);
        process.stdout.write(`${DIM}Raw stderr (tail):${RESET}\n`);
        process.stdout.write(`${DIM}${tail((stderr || '').trim(), 6000)}${RESET}\n`);
        process.stdout.write(`${DIM}Raw stdout (tail):${RESET}\n`);
        process.stdout.write(`${DIM}${tail((stdout || '').trim(), 6000)}${RESET}\n\n`);
    }
    for (const f of failures) {
        process.stdout.write(`  ${YELLOW}${f.title}${RESET}\n`);
        process.stdout.write(`  ${DIM}${f.file}${RESET}\n`);
        for (const msg of f.messages) {
            const lines = msg.split('\n').map((l) => `    ${l}`).join('\n');
            process.stdout.write(`${DIM}${lines}${RESET}\n`);
        }
        process.stdout.write('\n');
    }
    record({ name, ok: false, elapsed, totals, failures });
    return false;
}

// Final gate: verify the generated Firestore schema docs are in sync with COLLECTION_SCHEMAS, and
// auto-regenerate them if they are stale. Needs ttt-core's dist (the build stage produced it). One
// line of output — up to date, or "check failed — regenerated" — and only a multi-line dump if the
// regeneration itself errors (a real failure). Exit stays 0 on regenerate: you commit the docs next.
async function stageSchema(name, root) {
    printStart(name);
    const t0 = performance.now();
    const check = await runCmd('node', ['scripts/generate-schema-docs.mjs', '--check'], { cwd: root });
    if (check.code === 0) {
        const elapsed = performance.now() - t0;
        printOk(name, `up to date · ${fmtTime(elapsed)}`);
        record({ name, ok: true, elapsed });
        return true;
    }
    // Stale — regenerate from the freshly-built ttt-core dist.
    const regen = await runCmd('node', ['scripts/generate-schema-docs.mjs'], { cwd: root });
    const elapsed = performance.now() - t0;
    if (regen.code === 0) {
        stopHeartbeatAndPrint(`${YELLOW}✓${RESET} ${name} ${DIM}(check failed — regenerated docs; commit docs/generated/firestore-schema.{md,mmd}) · ${fmtTime(elapsed)}${RESET}`);
        record({ name, ok: true, regenerated: true, elapsed });
        return true;
    }
    printFail(name, fmtTime(elapsed));
    const blob = (regen.stdout + '\n' + regen.stderr).trim();
    process.stdout.write(`${DIM}${tail(blob, 6000)}${RESET}\n\n`);
    record({ name, ok: false, elapsed, errorBlob: blob });
    return false;
}

// ---------- main ----------
(async function main() {
    const overallStart = performance.now();
    const root = process.cwd();

    const header = only
        ? `${BOLD}Running quiet test suite${RESET} ${DIM}(only: ${[...only].join(', ')})${RESET}\n\n`
        : `${BOLD}Running quiet test suite${RESET}\n\n`;
    process.stdout.write(header);

    // Stop-on-fail chain — strict mirror of `test:all` (lint && typecheck && tsc -b && build && test),
    // with a final schema gate that only runs if everything above (tests included) passed.
    if (shouldRun('lint')) {
        if (!(await stagePlain('lint', 'npm', ['run', 'lint'], root))) return finish(overallStart);
    }
    if (shouldRun('typecheck')) {
        if (!(await stagePlain('typecheck', 'npm', ['run', 'typecheck'], root))) return finish(overallStart);
    }
    if (shouldRun('tscb')) {
        if (!(await stagePlain('tsc -b --noEmit', 'npx', ['tsc', '-b', '--noEmit'], root))) return finish(overallStart);
    }
    if (shouldRun('build')) {
        if (!(await stagePlain('build (all 22)', 'npm', ['run', 'build'], root))) return finish(overallStart);
    }
    if (shouldRun('test')) {
        if (!(await stageVitest('vitest', [], root))) return finish(overallStart);
    }
    // Final gate — reached only if every stage above passed. If tests failed we already returned.
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
            process.stdout.write(`  ${YELLOW}✓${RESET} ${r.name} ${DIM}(check failed — regenerated; commit the docs)${RESET}\n`);
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
        process.stdout.write(`\n${YELLOW}${BOLD}No stages ran${RESET} ${DIM}(check your --only value)${RESET}\n`);
        process.exit(0);
    } else if (failed.length > 0) {
        process.stdout.write(`\n${RED}${BOLD}${failed.length} stage${failed.length === 1 ? '' : 's'} failed${RESET}\n`);
        process.exit(1);
    } else if (regenerated) {
        process.stdout.write(`\n${GREEN}${BOLD}All stages passed${RESET} ${YELLOW}— schema docs were stale and have been regenerated; commit docs/generated/firestore-schema.{md,mmd} before publishing.${RESET}\n`);
        process.exit(0);
    } else {
        process.stdout.write(`\n${GREEN}${BOLD}All stages passed${RESET}\n`);
        process.exit(0);
    }
}
