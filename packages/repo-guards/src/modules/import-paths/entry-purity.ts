import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { builtinModules } from 'node:module';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Finding, GuardContext } from '../../guard.js';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import { reviewedProblems, textProblem, isList } from '../../support/facts.js';
import { MODULE_LOADS, moduleImports } from '../../support/imports.js';
import {
  ENTRY_IMPORT_TIMEOUT_MS,
  ENTRY_LOAD_TIMEOUT_MS,
  PACKAGE_GRAPH_TIMEOUT_MS,
} from '../../support/timeouts.js';

export type EntryRuntime = 'universal' | 'node' | 'react' | 'browser' | 'style';
const RUNTIMES: readonly EntryRuntime[] = ['node', 'react', 'browser', 'style'];

export interface EntryPurityFacts {
  packagesFolder: string;
  runtimeSubpaths: ReadonlyArray<{ subpath: string; runtime: Exclude<EntryRuntime, 'universal'> }>;
  exceptions: ReadonlyArray<{
    entry: string;
    runtime: Exclude<EntryRuntime, 'universal'>;
    why: string;
  }>;
  testRunnerSegment: string;
}

interface Entry {
  spec: string;
  packageDir: string;
  runtime: EntryRuntime;
  testRunner: boolean;
  js: string | null;
  types: string | null;
}

const slash = (path: string) => path.replace(/\\/g, '/');

const NODE_MODULES = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
const REACT = /^(react|react-dom|next|next-themes|lucide-react|@tanstack\/react-query)(\/|$)/;

function runtimeOfSpecifier(spec: string): Exclude<EntryRuntime, 'universal'> | null {
  if (spec.endsWith('.css')) return 'browser';
  if (spec.startsWith('node:') || NODE_MODULES.has(spec) || NODE_MODULES.has(spec.split('/')[0]))
    return 'node';
  if (/^firebase-(admin|functions)(\/|$)/.test(spec)) return 'node';
  if (REACT.test(spec)) return 'react';
  if (/^firebase(\/|$)/.test(spec)) return 'browser';
  return null;
}

function conditionPath(
  value: unknown,
  test: (path: string) => boolean,
  preferred: readonly string[],
): string | null {
  if (typeof value === 'string') return test(value) ? value : null;
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  for (const key of preferred)
    if (typeof record[key] === 'string' && test(record[key] as string))
      return record[key] as string;
  for (const nested of Object.values(record)) {
    const found = conditionPath(nested, test, preferred);
    if (found) return found;
  }
  return null;
}

const isDeclaration = (path: string) => /\.d\.[cm]?ts$/.test(path);
const isScript = (path: string) => /\.[cm]?js$/.test(path) && !isDeclaration(path);

function readEntries(
  repoRoot: string,
  facts: EntryPurityFacts,
): { entries: Entry[]; findings: Finding[] } {
  const folder = join(repoRoot, facts.packagesFolder);
  const dirs = existsSync(folder)
    ? readdirSync(folder, { withFileTypes: true }).filter(
        (d) => d.isDirectory() && existsSync(join(folder, d.name, 'package.json')),
      )
    : [];
  if (!dirs.length)
    return {
      entries: [],
      findings: [{ file: facts.packagesFolder, detail: 'the folder holds no package' }],
    };
  const bySubpath = new Map(facts.runtimeSubpaths.map((s) => [s.subpath, s.runtime]));
  const byException = new Map(facts.exceptions.map((e) => [e.entry, e.runtime]));
  const entries: Entry[] = [];
  for (const dirent of dirs) {
    const packageDir = join(folder, dirent.name);
    const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as {
      name: string;
      exports?: Record<string, unknown>;
    };
    for (const [key, value] of Object.entries(manifest.exports ?? {})) {
      if (key.includes('*') || key === './package.json') continue;
      const js = conditionPath(value, isScript, ['import', 'default']);
      const types = conditionPath(value, isDeclaration, ['types']);
      if (!js && !types) continue;
      const spec = key === '.' ? manifest.name : `${manifest.name}/${key.replace(/^\.\//, '')}`;
      const segments = key === '.' ? [] : key.replace(/^\.\//, '').split('/');
      const segment = segments[0];
      const runtime =
        byException.get(spec) ?? (segment ? bySubpath.get(segment) : undefined) ?? 'universal';
      entries.push({
        spec,
        packageDir,
        runtime,
        testRunner: segments.length > 1 && segments.at(-1) === facts.testRunnerSegment,
        js: js ? resolve(packageDir, js) : null,
        types: types ? resolve(packageDir, types) : null,
      });
    }
  }
  return { entries, findings: [] };
}

function resolveBuilt(from: string, spec: string, declaration: boolean): string | null {
  const base = resolve(dirname(from), spec);
  const stem = base.replace(/\.[cm]?js$/, '');
  const candidates = declaration
    ? [`${stem}.d.ts`, `${stem}.d.mts`, `${stem}.d.cts`, join(base, 'index.d.ts')]
    : [base, `${base}.js`, join(base, 'index.js')];
  return (
    candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null
  );
}

function runtimeReaches(
  start: string,
  declaration: boolean,
  entryOf: (spec: string) => Entry | undefined,
) {
  const reaches: Array<{ spec: string; runtime: string; file: string }> = [];
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      declaration ? ts.ScriptKind.TS : ts.ScriptKind.JS,
    );
    const kinds: readonly string[] = declaration ? [...MODULE_LOADS, 'importType'] : MODULE_LOADS;
    for (const reference of sourceFile.typeReferenceDirectives) {
      const runtime = runtimeOfSpecifier(
        reference.fileName === 'node' ? 'node:module' : reference.fileName,
      );
      if (runtime)
        reaches.push({ spec: `/// <reference types="${reference.fileName}" />`, runtime, file });
    }
    for (const reference of sourceFile.libReferenceDirectives) {
      if (/^dom/i.test(reference.fileName))
        reaches.push({
          spec: `/// <reference lib="${reference.fileName}" />`,
          runtime: 'browser',
          file,
        });
    }
    for (const site of moduleImports(sourceFile)) {
      if (!kinds.includes(site.kind)) continue;
      const { spec } = site;
      if (spec.startsWith('.')) {
        if (spec.endsWith('.css')) {
          reaches.push({ spec, runtime: 'browser', file });
          continue;
        }
        const target = resolveBuilt(file, spec, declaration);
        if (target) queue.push(target);
        continue;
      }
      const sibling = entryOf(spec);
      if (sibling) {
        if (sibling.runtime !== 'universal')
          reaches.push({ spec, runtime: `${sibling.runtime} entry`, file });
        continue;
      }
      const runtime = runtimeOfSpecifier(spec);
      if (runtime) reaches.push({ spec, runtime, file });
    }
  }
  return reaches;
}

const factProblems = (facts: EntryPurityFacts) => {
  const problems: string[] = [];
  textProblem(facts?.packagesFolder, 'packagesFolder', problems);
  if (
    typeof facts?.testRunnerSegment !== 'string' ||
    !facts.testRunnerSegment.trim() ||
    facts.testRunnerSegment.includes('/')
  )
    problems.push('testRunnerSegment names no single subpath segment');
  if (!isList(facts?.runtimeSubpaths)) problems.push('runtimeSubpaths is missing');
  else {
    const seen = new Set<string>();
    for (const entry of facts.runtimeSubpaths) {
      if (
        !entry ||
        typeof entry.subpath !== 'string' ||
        !entry.subpath.trim() ||
        entry.subpath.includes('/')
      ) {
        problems.push('a runtimeSubpaths entry names no single subpath segment');
      } else if (seen.has(entry.subpath))
        problems.push(`runtimeSubpaths lists ${entry.subpath} twice`);
      else seen.add(entry.subpath);
      if (!RUNTIMES.includes(entry?.runtime))
        problems.push(
          `runtimeSubpaths entry ${entry?.subpath} names no runtime (${RUNTIMES.join(', ')})`,
        );
    }
  }
  reviewedProblems(facts?.exceptions, 'exceptions', problems, {
    key: 'entry',
    extra: (entry, label) => {
      if (!RUNTIMES.includes(entry.runtime as EntryRuntime))
        problems.push(`${label} names no runtime (${RUNTIMES.join(', ')})`);
    },
  });
  return problems;
};

export const entryPurityGuard: GenericGuardDefinition<EntryPurityFacts> = {
  id: 'entryPurity',
  absentWhen: 'the repository holds no package of its own',
  factProblems,
  build(facts) {
    const read = (context: GuardContext) => {
      const repoRoot = context.reader.layout.repoRoot;
      const { entries, findings } = readEntries(repoRoot, facts);
      for (const entry of entries)
        context.file(slash(relative(repoRoot, join(entry.packageDir, 'package.json'))));
      return { repoRoot, entries, findings };
    };
    const rel = (repoRoot: string, file: string) => slash(relative(repoRoot, file));
    return [
      {
        title:
          'every entry not declared runtime-specific reaches no Node, React, or browser runtime',
        description:
          'An entry whose subpath is not declared runtime-specific (`./react`, `./server`, …) and is not a reviewed exception ' +
          'is universal: neither its built JavaScript nor its declaration files may import a Node module (`node:*` included), ' +
          'React, or a browser runtime, or reference their types, directly or through any module or runtime-specific sibling ' +
          'entry they reach. Move what needs the runtime behind the runtime-specific entry.',
        timeoutMs: PACKAGE_GRAPH_TIMEOUT_MS,
        run(context: GuardContext): Finding[] {
          const { repoRoot, entries, findings } = read(context);
          if (findings.length) return findings;
          const bySpec = new Map(entries.map((e) => [e.spec, e]));
          for (const exception of facts.exceptions) {
            const entry = bySpec.get(exception.entry);
            if (!entry)
              findings.push({
                file: exception.entry,
                detail: 'the exception names no entry of any package',
              });
          }
          for (const entry of entries) {
            const universal = entry.runtime === 'universal';
            const exception = facts.exceptions.find((e) => e.entry === entry.spec);
            if (!universal && !exception) continue;
            const reaches: Array<{ spec: string; runtime: string; file: string }> = [];
            for (const [file, declaration] of [
              [entry.js, false],
              [entry.types, true],
            ] as const) {
              if (!file) continue;
              if (!existsSync(file)) {
                findings.push({
                  file: rel(repoRoot, file),
                  detail: `${entry.spec} is not built — build the packages before the guard runs`,
                });
                continue;
              }
              reaches.push(...runtimeReaches(file, declaration, (spec) => bySpec.get(spec)));
            }
            if (exception) {
              if (!reaches.length)
                findings.push({
                  file: exception.entry,
                  detail: 'the exception is stale: the entry reaches no runtime-specific module',
                });
              continue;
            }
            const unique = new Map(reaches.map((r) => [`${r.spec}\0${r.file}`, r]));
            for (const r of unique.values()) {
              findings.push({
                file: rel(repoRoot, r.file),
                detail: `${entry.spec} reaches ${r.spec} (${r.runtime})`,
              });
            }
          }
          return findings;
        },
      },
      {
        title: 'every universal and Node entry loads under plain Node',
        description:
          'Each entry that is universal or declared for Node is imported, built, in a fresh Node process; it must evaluate ' +
          'without error. A failure names the error the import threw. A test-runner entry (`./<runtime>/testing`) runs ' +
          'only inside the test runner, so it is never loaded here; its runtime segment still binds its purity.',
        timeoutMs: ENTRY_LOAD_TIMEOUT_MS,
        run(context: GuardContext): Finding[] {
          const { repoRoot, entries, findings } = read(context);
          if (findings.length) return findings;
          for (const entry of entries) {
            if ((entry.runtime !== 'universal' && entry.runtime !== 'node') || !entry.js) continue;
            if (entry.testRunner) continue;
            if (!existsSync(entry.js)) {
              findings.push({
                file: rel(repoRoot, entry.js),
                detail: `${entry.spec} is not built — build the packages before the guard runs`,
              });
              continue;
            }
            try {
              execFileSync(
                process.execPath,
                [
                  '--input-type=module',
                  '-e',
                  `await import(${JSON.stringify(pathToFileURL(entry.js).href)});`,
                ],
                {
                  cwd: repoRoot,
                  stdio: 'pipe',
                  timeout: ENTRY_IMPORT_TIMEOUT_MS,
                  shell: false,
                },
              );
            } catch (err) {
              const stderr = String((err as { stderr?: unknown }).stderr ?? '');
              const reason =
                stderr
                  .split(/\r?\n/)
                  .find((line) => /^\w*Error( \[\w+\])?:/.test(line))
                  ?.trim() ?? (err as Error).message;
              findings.push({
                file: rel(repoRoot, entry.js),
                detail: `${entry.spec} does not load under Node: ${reason}`,
              });
            }
          }
          return findings;
        },
      },
    ];
  },
};
