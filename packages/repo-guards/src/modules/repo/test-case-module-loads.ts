import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import { viewOfText, type FileView } from '../../reader/view.js';
import { forEachNode } from '../../support/ast.js';
import { namesProblem, objectProblem, reviewedProblems } from '../../support/facts.js';
import { REPOSITORY_GUARD_TIMEOUT_MS } from '../../support/timeouts.js';

const REGISTRY_RESETS: ReadonlySet<string> = new Set(['vi.resetModules', 'jest.resetModules']);

const COLLECTION_CALLBACKS: ReadonlySet<string> = new Set([
  'vi.hoisted',
  'vi.mock',
  'vi.doMock',
  'jest.mock',
  'jest.doMock',
]);

const dottedCallee = (call: ts.CallExpression): string | null =>
  ts.isPropertyAccessExpression(call.expression) && ts.isIdentifier(call.expression.expression)
    ? `${call.expression.expression.text}.${call.expression.name.text}`
    : null;

const isLocal = (spec: string, aliases: readonly string[]) =>
  spec.startsWith('./') || spec.startsWith('../') || aliases.some((a) => spec.startsWith(a));

function runsInsideACase(node: ts.Node): boolean {
  for (let at: ts.Node | undefined = node.parent; at; at = at.parent) {
    if (!ts.isFunctionLike(at)) continue;
    const call = at.parent;
    if (call && ts.isCallExpression(call) && COLLECTION_CALLBACKS.has(dottedCallee(call) ?? ''))
      return false;
    return true;
  }
  return false;
}

export interface TestCaseModuleLoad {
  index: number;
  detail: string;
}

export function testCaseModuleLoads(
  source: FileView | string,
  aliases: readonly string[],
): TestCaseModuleLoad[] {
  const file = typeof source === 'string' ? viewOfText('sample.test.ts', source) : source;
  const sf = file.sourceFile;
  const hits: TestCaseModuleLoad[] = [];
  forEachNode(sf, (node) => {
    if (ts.isCallExpression(node) && REGISTRY_RESETS.has(dottedCallee(node) ?? ''))
      hits.push({
        index: node.getStart(sf),
        detail: `${dottedCallee(node)}() reloads every module for the cases after it`,
      });
  });
  for (const load of file.imports) {
    if (load.kind !== 'dynamic' || load.typeOnly || !isLocal(load.spec, aliases)) continue;
    if (!runsInsideACase(load.node)) continue;
    hits.push({
      index: load.node.getStart(sf),
      detail: `import('${load.spec}') loads the module inside a test case`,
    });
  }
  return hits.sort((a, b) => a.index - b.index);
}

const SCOPE: Scope = {
  roots: ['app', 'functions', 'scripts', 'workers'],
  kinds: ['code'],
  tests: 'only',
  optionalRoots: ['functions', 'scripts', 'workers'],
};

export interface TestCaseModuleLoadFacts {
  localAliases: readonly string[];
  reviewed: ReadonlyArray<{ path: string; why: string }>;
}

export const testCaseModuleLoadGuard: GenericGuardDefinition<TestCaseModuleLoadFacts> = {
  id: 'testCaseModuleLoads',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'the facts', problems)) return problems;
    namesProblem(facts.localAliases, 'localAliases', problems, { nonEmpty: false });
    reviewedProblems(facts.reviewed, 'reviewed', problems);
    return problems;
  },
  build(facts) {
    const reviewed = new Map(facts.reviewed.map((entry) => [entry.path, entry]));
    return [
      {
        title: 'a test loads the code it tests when its file loads, never inside a test case',
        description:
          "No test, hook, or helper a test calls resets the module registry or runs a dynamic import() of the app's own " +
          "code: the module graph's cold load then lands inside one case's timeout — the file's first case is slow for no " +
          'work of its own, and under a full parallel run it times out. Import the code at the top of the file (set any ' +
          'environment it reads at load in vi.hoisted first). A file that must load a module fresh per case is a reviewed ' +
          'entry with its why; an entry whose file no longer does is stale.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run(context) {
          const findings: Finding[] = [];
          const seen = new Set<string>();
          for (const file of context.files(SCOPE)) {
            const loads = testCaseModuleLoads(file, facts.localAliases);
            if (!loads.length) continue;
            if (reviewed.has(file.path)) {
              seen.add(file.path);
              continue;
            }
            for (const load of loads)
              findings.push({
                file: file.path,
                line: file.lineOf(load.index),
                detail: load.detail,
              });
          }
          for (const path of reviewed.keys())
            if (!seen.has(path))
              findings.push({
                file: path,
                detail:
                  'stale reviewed entry: the file no longer loads a module inside a test case',
              });
          return findings;
        },
      },
    ];
  },
};
