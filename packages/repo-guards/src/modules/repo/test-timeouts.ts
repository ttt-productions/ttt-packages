// A test's time limit is a named budget, never a number. Every test runs on the runner's default
// limit; one that needs longer — real work such as spawning a media encoder — names a constant the
// app declares in its timeout files, so the budgets live in one place, every test that needs more is
// found by that name, and no test raises its own limit quietly to get past a slow run. The same holds
// for a test library's own waits (`waitFor`, `findBy…`), which give up on their own clock.
//
// The constants are the numeric `const`s the app's timeout files export; a test uses one only by
// importing it from that file. A number written where a limit is set — a test, suite, or hook
// timeout, `vi.setConfig`, a wait's `timeout`, a library's `asyncUtilTimeout` — fails, and so does a
// name that is no such constant.

import ts from 'typescript';
import type { Finding } from '../../guard.js';
import { isTestPath } from '../../node/layout.js';
import type { RepoReader, Scope } from '../../node/reader.js';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import { viewOfText, type FileView } from '../../reader/view.js';
import { forEachNode, lineOfNode, unwrap } from '../../support/ast.js';
import { isText, objectProblem, pathProblem } from '../../support/facts.js';
import { aliasList, resolveSpecifier } from '../../support/resolve-specifier.js';

const SCOPE: Scope = {
  roots: ['app', 'functions', 'scripts', 'workers'],
  kinds: ['code'],
  tests: 'only',
  optionalRoots: ['functions', 'scripts', 'workers'],
};

/** The test-runner functions whose calls set a test's or a suite's limit. */
const RUNNERS: ReadonlySet<string> = new Set(['it', 'test', 'describe', 'suite', 'bench']);
/** The hooks whose second argument is their limit. */
const HOOKS: ReadonlySet<string> = new Set(['beforeAll', 'afterAll', 'beforeEach', 'afterEach']);
/** The waits that take `{ timeout }` beside what they wait for. */
const WAITS: ReadonlySet<string> = new Set(['waitFor', 'waitForElementToBeRemoved']);
const isFindQuery = (name: string) => /^find(All)?By[A-Z]/.test(name);

/** The name a call chain starts from: `it.skipIf(x).each(t)(…)` → `it`. */
function rootName(expression: ts.Expression): string | undefined {
  let at: ts.Expression = expression;
  for (;;) {
    if (ts.isPropertyAccessExpression(at)) at = at.expression;
    else if (ts.isCallExpression(at)) at = at.expression;
    else if (ts.isTaggedTemplateExpression(at)) at = at.tag;
    else break;
  }
  return ts.isIdentifier(at) ? at.text : undefined;
}

const dotted = (expression: ts.Expression): string | undefined =>
  ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)
    ? `${expression.expression.text}.${expression.name.text}`
    : undefined;

const ownName = (expression: ts.Expression): string | undefined =>
  ts.isIdentifier(expression)
    ? expression.text
    : ts.isPropertyAccessExpression(expression)
      ? expression.name.text
      : undefined;

/** One place a limit is set: the expression that gives it, and what it limits. */
interface LimitSite {
  value: ts.Expression;
  what: string;
}

/** A same-file `const X = { … }`, so `waitFor(fn, WAIT)` reads the object `WAIT` holds. */
function objectBehind(
  file: FileView,
  expression: ts.Expression,
): ts.ObjectLiteralExpression | null {
  const value = unwrap(expression);
  if (ts.isObjectLiteralExpression(value)) return value;
  if (!ts.isIdentifier(value)) return null;
  let found: ts.ObjectLiteralExpression | null = null;
  forEachNode(file.sourceFile, (node) => {
    if (
      !found &&
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === value.text &&
      node.initializer &&
      ts.isObjectLiteralExpression(unwrap(node.initializer))
    )
      found = unwrap(node.initializer) as ts.ObjectLiteralExpression;
  });
  return found;
}

function limitsIn(
  object: ts.ObjectLiteralExpression,
  keys: readonly string[],
  what: string,
): LimitSite[] {
  const out: LimitSite[] = [];
  for (const prop of object.properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      ts.isIdentifier(prop.name) &&
      keys.includes(prop.name.text)
    )
      out.push({ value: prop.initializer, what: `${what} ${prop.name.text}` });
    else if (ts.isShorthandPropertyAssignment(prop) && keys.includes(prop.name.text))
      out.push({ value: prop.name, what: `${what} ${prop.name.text}` });
  }
  return out;
}

/** Every place a test file sets a limit. A string is read as a sample test file. */
export function limitSites(source: FileView | string): Array<LimitSite & { node: ts.Node }> {
  const file = typeof source === 'string' ? viewOfText('sample.test.ts', source) : source;
  const out: Array<LimitSite & { node: ts.Node }> = [];
  const add = (sites: LimitSite[], node: ts.Node) => {
    for (const site of sites) out.push({ ...site, node });
  };
  forEachNode(file.sourceFile, (node) => {
    if (!ts.isCallExpression(node)) return;
    const callee = node.expression;
    const root = rootName(callee);
    const name = ownName(callee);
    const call = dotted(callee);
    if (call === 'vi.setConfig' || call === 'jest.setTimeout') {
      if (call === 'jest.setTimeout' && node.arguments[0])
        add([{ value: node.arguments[0], what: 'the test timeout' }], node);
      const object = node.arguments[0] && objectBehind(file, node.arguments[0]);
      if (object) add(limitsIn(object, ['testTimeout', 'hookTimeout'], 'the config'), node);
      return;
    }
    if (name === 'configure' && node.arguments[0]) {
      const object = objectBehind(file, node.arguments[0]);
      if (object) add(limitsIn(object, ['asyncUtilTimeout'], 'the test library'), node);
      return;
    }
    if (root && HOOKS.has(root) && ts.isIdentifier(callee) && node.arguments[1]) {
      add([{ value: node.arguments[1], what: `the ${root} timeout` }], node);
      return;
    }
    if (root && RUNNERS.has(root) && !(name && WAITS.has(name))) {
      // The title comes first; a limit is a later number, or a later options object's `timeout`.
      for (const arg of node.arguments.slice(1)) {
        const value = unwrap(arg);
        if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) continue;
        if (ts.isObjectLiteralExpression(value)) {
          add(limitsIn(value, ['timeout'], `the ${root} option`), node);
          continue;
        }
        if (
          ts.isIdentifier(value) ||
          ts.isNumericLiteral(value) ||
          ts.isBinaryExpression(value) ||
          ts.isPrefixUnaryExpression(value)
        )
          add([{ value: arg, what: `the ${root} timeout` }], node);
      }
      return;
    }
    if (name && (WAITS.has(name) || isFindQuery(name))) {
      for (const arg of node.arguments.slice(1)) {
        const object = objectBehind(file, arg);
        if (object) add(limitsIn(object, ['timeout'], `the ${name} wait`), node);
      }
    }
  });
  return out;
}

export interface TestTimeoutFacts {
  /** Specifier prefix → repo-relative folder (`{ '@/': 'src/' }`), so an import names its file. */
  importAliases: Readonly<Record<string, string>>;
  /**
   * The repo-relative test-code files that declare the timeout constants: each exported numeric
   * `const` is one budget a test may name. `[]` when the app declares none — then no test sets a
   * limit of its own.
   */
  timeoutFiles: readonly string[];
}

/** The numeric `const`s a timeout file exports. */
function exportedBudgets(file: FileView): Set<string> {
  const names = new Set<string>();
  for (const statement of file.sourceFile.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !(ts.getModifiers(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ||
      !(statement.declarationList.flags & ts.NodeFlags.Const)
    )
      continue;
    for (const d of statement.declarationList.declarations) {
      const value = d.initializer && unwrap(d.initializer);
      if (ts.isIdentifier(d.name) && value && ts.isNumericLiteral(value)) names.add(d.name.text);
    }
  }
  return names;
}

function check(reader: RepoReader, facts: TestTimeoutFacts, files: FileView[]): Finding[] {
  const findings: Finding[] = [];
  const budgetsOf = new Map<string, Set<string>>();
  for (const path of facts.timeoutFiles) {
    if (!reader.exists(path)) {
      findings.push({ file: path, detail: `the timeout file ${path} no longer exists` });
      continue;
    }
    if (!isTestPath(reader.layout, path)) {
      findings.push({
        file: path,
        detail: `the timeout file ${path} is not test code — the budgets live with the tests`,
      });
      continue;
    }
    const budgets = exportedBudgets(reader.file(path));
    if (!budgets.size)
      findings.push({
        file: path,
        detail: `the timeout file ${path} exports no numeric const budget`,
      });
    budgetsOf.set(path, budgets);
  }
  const aliases = aliasList(facts.importAliases);
  for (const file of files) {
    if (budgetsOf.has(file.path)) continue;
    const sites = limitSites(file);
    if (!sites.length) continue;
    // The budgets this file imports, by local name.
    const imported = new Set<string>();
    for (const site of file.imports) {
      if (site.kind !== 'import') continue;
      const owner = resolveSpecifier(reader, file.path, site.spec, aliases);
      const budgets = budgetsOf.get(owner);
      if (!budgets) continue;
      for (const named of site.named) if (budgets.has(named.imported)) imported.add(named.local);
    }
    for (const site of sites) {
      const value = unwrap(site.value);
      if (ts.isIdentifier(value) && imported.has(value.text)) continue;
      findings.push({
        file: file.path,
        line: lineOfNode(file, site.node),
        detail: ts.isIdentifier(value)
          ? `${site.what} is ${value.text}, which is no budget imported from a timeout file — name one of its constants`
          : `${site.what} is written as a number — leave the default, or name a budget from a timeout file`,
      });
    }
  }
  return findings;
}

function factProblems(facts: TestTimeoutFacts): string[] {
  const problems: string[] = [];
  if (!objectProblem(facts, 'the facts', problems)) return problems;
  if (objectProblem(facts.importAliases, 'importAliases', problems))
    for (const [prefix, folder] of Object.entries(facts.importAliases))
      if (!prefix || !isText(folder))
        problems.push(`importAliases ${prefix} needs a target folder`);
  if (!Array.isArray(facts.timeoutFiles))
    problems.push('timeoutFiles is missing (declare [] when there is none)');
  else {
    const seen = new Set<string>();
    for (const path of facts.timeoutFiles as unknown[]) {
      pathProblem(path, 'a timeoutFiles entry', problems);
      if (isText(path) && seen.has(path)) problems.push(`timeoutFiles lists ${path} twice`);
      if (isText(path)) seen.add(path);
    }
  }
  return problems;
}

export const testTimeoutGuard: GenericGuardDefinition<TestTimeoutFacts> = {
  id: 'testTimeouts',
  absentWhen: false,
  factProblems,
  build(facts) {
    return [
      {
        title: 'a test sets a time limit only by naming a budget from a timeout file',
        description:
          'Every test runs on the default limit. A test, suite, hook, config, or wait that needs longer names a numeric ' +
          "constant exported by one of the app's timeout files, imported from it — never a number written in place, and " +
          'never a name that is no such constant. A timeout file that no longer exists, is not test code, or exports no ' +
          'budget fails too.',
        timeoutMs: 120_000,
        run(context) {
          return check(context.reader, facts, context.files(SCOPE));
        },
      },
    ];
  },
};

export interface SlowTestCase {
  file: string;
  name: string;
  durationMs: number;
}

/**
 * Report-only: every test case at or over `thresholdMs` in a test file that imports no budget from
 * a timeout file — the ones a busier machine pushes past the default limit. Read from the runner's
 * JSON results (`--reporter=json`); a case is named by its file and full name. Never a failure.
 */
export function slowTestReport(
  reader: RepoReader,
  facts: TestTimeoutFacts,
  results: ReadonlyArray<{
    testResults: ReadonlyArray<{
      name: string;
      assertionResults: ReadonlyArray<{ fullName: string; duration?: number | null }>;
    }>;
  }>,
  thresholdMs: number,
): SlowTestCase[] {
  const aliases = aliasList(facts.importAliases);
  const budgetFiles = new Set(facts.timeoutFiles);
  const root = reader.layout.repoRoot.replace(/\\/g, '/').replace(/\/$/, '');
  const usesBudget = new Map<string, boolean>();
  const marked = (rel: string): boolean => {
    if (!usesBudget.has(rel)) {
      let uses = false;
      if (reader.exists(rel)) {
        for (const site of reader.file(rel).imports)
          if (
            site.kind === 'import' &&
            budgetFiles.has(resolveSpecifier(reader, rel, site.spec, aliases))
          )
            uses = true;
      }
      usesBudget.set(rel, uses);
    }
    return usesBudget.get(rel)!;
  };
  const out: SlowTestCase[] = [];
  for (const result of results)
    for (const testFile of result.testResults) {
      const abs = testFile.name.replace(/\\/g, '/');
      const rel = abs.toLowerCase().startsWith(`${root.toLowerCase()}/`)
        ? abs.slice(root.length + 1)
        : abs;
      for (const test of testFile.assertionResults) {
        const durationMs = test.duration ?? 0;
        if (durationMs >= thresholdMs && !marked(rel))
          out.push({ file: rel, name: test.fullName, durationMs });
      }
    }
  return out.sort((a, b) => b.durationMs - a.durationMs || (a.file < b.file ? -1 : 1));
}
