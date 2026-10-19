// The shell-safety, directory-walker, and test-source-root guards over temp repositories: a clean
// tree passes, and each shape the guards exist to catch produces its exact finding.

import { afterEach, describe, expect, it } from 'vitest';
import { shellSafeGuard, shellWithArgsArray } from '../../src/modules/repo/shell-safe.js';
import { testSourceRootGuard } from '../../src/modules/repo/test-source-root.js';
import { walkerReadFailureGuard } from '../../src/modules/repo/walker-read-failure.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

const layoutOf = (root: string) => ({
  repoRoot: root,
  roots: {
    app: { path: 'src', anchor: 'src/index.ts' },
    functions: { path: 'functions/src', anchor: 'functions/src/index.ts' },
    scripts: { path: 'scripts', anchor: 'scripts/run.mjs' },
  },
});

async function findingsOf(definition: { build(facts: never): Array<{ run: (c: never) => unknown }> }, files: Record<string, string>) {
  repo = tempRepo({ 'src/index.ts': 'export {};', 'functions/src/index.ts': 'export {};', 'scripts/run.mjs': 'export {};', ...files });
  const [guard] = definition.build({} as never);
  const findings = (await guard.run(contextOf(createRepoReader(layoutOf(repo.root))) as never)) as Array<{ file: string; line?: number; detail: string }>;
  return findings.map((f) => `${f.file}:${f.line} ${f.detail}`);
}

const call = (callee: string, args: string) => `${callee}(${args});`;

describe('no child process gets an args array together with a shell', () => {
  it('flags every inline options form that turns a shell on', () => {
    expect(shellWithArgsArray(call('spawn', 'cmd, args, { shell: true }'))).toHaveLength(1);
    expect(shellWithArgsArray(call('execFileSync', "cmd, ['-v'], { shell: isWindows, stdio: 'pipe' }"))).toHaveLength(1);
    expect(shellWithArgsArray(call('spawnSync', 'cmd, args, { shell }'))).toHaveLength(1);
    expect(shellWithArgsArray(call('spawn', "cmd, args, { 'shell': '/bin/sh' }"))).toHaveLength(1);
  });

  it('passes one command string, and an args array whose options leave the shell off', () => {
    expect(shellWithArgsArray(call('spawn', "[cmd, ...args].join(' '), { shell: true, ...opts }"))).toEqual([]);
    expect(shellWithArgsArray(call('spawn', "'ffmpeg', ['-i', `${dir}/in`], { stdio: 'pipe' }"))).toEqual([]);
    expect(shellWithArgsArray(call('execFile', 'file, { shell: true }, (err) => onExit(err)'))).toEqual([]);
    expect(shellWithArgsArray(call('spawn', "cmd, args, { stdio: 'pipe', shell: false }"))).toEqual([]);
    expect(shellWithArgsArray(call('spawn', "cmd, args, { env: { shell: 'x' } }"))).toEqual([]);
    expect(shellWithArgsArray(call('spawn', "cmd, args, { stdio: 'pipe' /* shell: true */ }"))).toEqual([]);
    expect(shellWithArgsArray(call('spawn', "cmd, args, { stdio: 'pipe', // no shell:\n }"))).toEqual([]);
  });

  it('passes a clean repository', async () => {
    expect(await findingsOf(shellSafeGuard, { 'scripts/ok.mjs': "spawn('npm', ['test'], { stdio: 'inherit' });" })).toEqual([]);
  });

  it('flags the call in any declared code root, tests included, and ignores a commented one', async () => {
    expect(
      await findingsOf(shellSafeGuard, {
        'scripts/bad.mjs': `import { spawn } from 'node:child_process';\n${call('spawn', 'cmd, args, { shell: true }')}`,
        'functions/src/__tests__/run.test.ts': `// ${call('spawn', 'cmd, args, { shell: true }')}\n${call('execFileSync', "cmd, ['-v'], { shell }")}`,
      }),
    ).toEqual([
      'functions/src/__tests__/run.test.ts:2 an args array is handed to a shell',
      'scripts/bad.mjs:2 an args array is handed to a shell',
    ]);
  });

  it('takes no facts', () => {
    expect(shellSafeGuard.factProblems({ roots: [] } as never)).toEqual(['this guard takes no facts: declare it with {}']);
  });
});

describe('no directory walker turns an unreadable folder into an empty answer', () => {
  it('passes a walker that lets the failure throw or rethrows it', async () => {
    expect(
      await findingsOf(walkerReadFailureGuard, {
        'scripts/walk.mjs': [
          'const a = readdirSync(dir);',
          'try { e = readdirSync(d); } catch (err) { throw new Error(`cannot read ${d}`, { cause: err }); }',
          "try { e = readdirSync(d); } catch (err) { if (err.code === 'ENOENT') return []; throw err; }",
          'const b = await readdir(d).catch((err) => Promise.reject(err));',
          'try { JSON.parse(x); } catch { return null; }',
        ].join('\n'),
      }),
    ).toEqual([]);
  });

  it('flags every catch that answers with nothing, a value, or continue — in each root, tests included', async () => {
    expect(
      await findingsOf(walkerReadFailureGuard, {
        'src/a.ts': 'try {\n  entries = readdirSync(dir);\n} catch {\n  return results;\n}',
        'functions/src/b.ts': 'for (const r of roots) {\n  try { e = readdirSync(r, { recursive: true }); } catch { continue; }\n}',
        'scripts/c.mjs': 'try { e = fs.readdirSync(d); } catch (err) { return false; }',
        'scripts/d.mjs': 'try { e = readdirSync(d); } catch { console.warn("skip"); }',
        'scripts/e.mjs': 'const entries = await readdir(d).catch(() => []);',
        'src/__tests__/f.test.ts': 'try { readdirSync(d); } catch {}',
      }),
    ).toEqual([
      'functions/src/b.ts:2 a directory-read failure is swallowed',
      'scripts/c.mjs:1 a directory-read failure is swallowed',
      'scripts/d.mjs:1 a directory-read failure is swallowed',
      'scripts/e.mjs:1 a directory-read failure is swallowed',
      'src/__tests__/f.test.ts:1 a directory-read failure is swallowed',
      'src/a.ts:3 a directory-read failure is swallowed',
    ]);
  });
});

describe('Functions tests resolve source from their own location', () => {
  it('passes a test that resolves from its module URL, and a mention in a comment or string', async () => {
    expect(
      await findingsOf(testSourceRootGuard, {
        'functions/src/x.test.ts': [
          '// never `process.cwd()`, which depends on where the runner started',
          "const note = 'process.cwd()';",
          "const src = join(dirname(fileURLToPath(import.meta.url)), 'x.ts');",
        ].join('\n'),
      }),
    ).toEqual([]);
  });

  it('flags a process.cwd() call in a test or a test helper, and leaves non-test source alone', async () => {
    expect(
      await findingsOf(testSourceRootGuard, {
        'functions/src/x.test.ts': "const a = 1;\nconst SRC = join(process.cwd(), 'src');",
        'functions/src/__tests__/helper.ts': 'export const root = () => process.cwd();',
        'functions/src/server.ts': 'export const here = process.cwd();',
      }),
    ).toEqual(['functions/src/__tests__/helper.ts:1 calls process.cwd()', 'functions/src/x.test.ts:2 calls process.cwd()']);
  });

  it('may be declared absent only for an app with no Functions tree', () => {
    expect(testSourceRootGuard.absentWhen).toBe('the app has no Cloud Functions tree');
  });
});
