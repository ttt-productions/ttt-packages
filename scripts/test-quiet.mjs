#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The gate runner is repo-guards' own (`runQuietGate`), and a release preflight starts from a tree
// with no `dist`, so repo-guards is built here before it is loaded. It needs no other package built.
const runner = spawnSync('npm run build -w @ttt-productions/repo-guards', {
  cwd: ROOT,
  shell: true,
  encoding: 'utf8',
});
if (runner.status !== 0) {
  process.stderr.write(
    `The gate runner (@ttt-productions/repo-guards) did not build, so no stage ran.\n${runner.stdout}\n${runner.stderr}\n`,
  );
  process.exit(1);
}
const { runQuietGate } = await import('@ttt-productions/repo-guards/node/tooling');

const FORMAT_CHECK_ONLY = '--format-check-only';

const command = (label, executable, args, repair) => ({
  kind: 'command',
  label,
  command: executable,
  args,
  cwd: ROOT,
  ...(repair ? { repair } : {}),
});
const npmRun = (label, script) => command(label, 'npm', ['run', script]);

const stage = (id, description, steps) => ({ id, description, stopOnFailure: true, steps });

await runQuietGate({
  title: 'quiet test suite',
  script: 'test-quiet.mjs',
  logDir: path.join(ROOT, '.logs', 'test-quiet'),
  flags: [
    {
      flag: FORMAT_CHECK_ONLY,
      description:
        "The format stage only checks (prettier --check) and never writes: the release preflight's form, so a release never publishes formatting nobody committed.",
    },
  ],
  stages: [
    // The publish workflow's audit command, verbatim.
    stage('audit', 'npm audit of the shipped dependencies, as the publish workflow runs it', () => [
      command('audit (prod deps, high)', 'npm', ['audit', '--omit=dev', '--audit-level=high']),
    ]),
    // Before lint and the type checks, which resolve @ttt-productions/* through dist (preflight wipes it).
    stage('build', 'every package, in dependency order', () => [
      npmRun('build (all packages)', 'build'),
    ]),
    stage('lint', 'eslint', () => [npmRun('lint', 'lint')]),
    stage('format', 'prettier writes, then checks', () =>
      process.argv.includes(FORMAT_CHECK_ONLY)
        ? [npmRun('format (prettier --check)', 'format:check')]
        : [
            npmRun('format (prettier --write)', 'format'),
            npmRun('format (prettier --check)', 'format:check'),
          ],
    ),
    stage('typecheck', "every package's typecheck", () => [npmRun('typecheck', 'typecheck')]),
    stage('tscb', 'tsc -b --noEmit, which also type-checks the tests', () => [
      command('tsc -b --noEmit', 'npx', ['tsc', '-b', '--noEmit']),
    ]),
    // Only through the root `test` script: it alone chooses the threads pool.
    stage('test', 'vitest, every package and the boundary suite', () => [
      { kind: 'vitest', label: 'vitest', cwd: ROOT, npmScript: 'test' },
    ]),
    // Needs ttt-core's dist, which the build stage produces.
    stage('schema', 'the generated schema docs, regenerated when stale', () => [
      command('schema', 'node', ['scripts/generate-schema-docs.mjs', '--check'], {
        command: 'node',
        args: ['scripts/generate-schema-docs.mjs'],
        note: 'the schema docs were stale and are regenerated; commit docs/generated/firestore-schema.{md,mmd} before publishing',
      }),
    ]),
  ],
});
