import ts from 'typescript';
import type { Finding } from '../../guard.js';
import type { RepoReader, Scope } from '../../node/reader.js';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { FileView } from '../../reader/view.js';
import { forEachNode, lineOfNode, unwrap } from '../../support/ast.js';
import {
  importAliasesProblem,
  isText,
  namesProblem,
  objectProblem,
  pathProblem,
  textProblem,
} from '../../support/facts.js';
import { aliasList, resolveSpecifier } from '../../support/resolve-specifier.js';
import { REPOSITORY_GUARD_TIMEOUT_MS } from '../../support/timeouts.js';
import type { SharedFake } from './shared-fakes.js';

const MOCK_CALLS: ReadonlySet<string> = new Set(['vi.mock', 'vi.doMock']);

const SCOPE: Scope = {
  roots: ['app', 'functions', 'scripts', 'workers'],
  kinds: ['code'],
  tests: 'only',
  optionalRoots: ['functions', 'scripts', 'workers'],
};

export interface TypedMockHelper {
  owner: string;
  names: readonly string[];
}

export interface ForbiddenOverride {
  module: string;
  names: readonly string[];
  why: string;
}

export interface TypedMockFacts {
  importAliases: Readonly<Record<string, string>>;
  fakes: readonly SharedFake[];
  typedHelpers: readonly TypedMockHelper[];
  forbiddenOverrides: readonly ForbiddenOverride[];
}

interface Site {
  node: ts.CallExpression;
  module: string;
  factory: ts.Expression | undefined;
}

function sitesOf(reader: RepoReader, file: FileView, aliases: Array<[string, string]>): Site[] {
  const out: Site[] = [];
  for (const site of file.imports) {
    if (site.kind !== 'mock' || !MOCK_CALLS.has(site.callee ?? '')) continue;
    if (!ts.isCallExpression(site.node)) continue;
    out.push({
      node: site.node,
      module: resolveSpecifier(reader, file.path, site.spec, aliases),
      factory: site.node.arguments[1],
    });
  }
  return out;
}

function factoryFunction(factory: ts.Expression): ts.ArrowFunction | ts.FunctionExpression | null {
  const value = unwrap(factory);
  return ts.isArrowFunction(value) || ts.isFunctionExpression(value) ? value : null;
}

function returnedExpression(fn: ts.ArrowFunction | ts.FunctionExpression): ts.Expression | null {
  if (!ts.isBlock(fn.body)) return fn.body;
  for (let i = fn.body.statements.length - 1; i >= 0; i--) {
    const statement = fn.body.statements[i];
    if (ts.isReturnStatement(statement)) return statement.expression ?? null;
  }
  return null;
}

const awaited = (expression: ts.Expression): ts.Expression => {
  const value = unwrap(expression);
  return ts.isAwaitExpression(value) ? unwrap(value.expression) : value;
};

function importedSpecifier(expression: ts.Expression): string | null {
  const value = awaited(expression);
  if (!ts.isCallExpression(value) || value.expression.kind !== ts.SyntaxKind.ImportKeyword)
    return null;
  const [spec] = value.arguments;
  return spec && ts.isStringLiteralLike(spec) ? spec.text : null;
}

type Owners = ReadonlyMap<string, ReadonlySet<string> | 'any'>;

interface Binding {
  path: string;
  name: string | null;
}

function bindingsOf(
  fn: ts.ArrowFunction | ts.FunctionExpression,
  resolve: (spec: string) => string,
): Map<string, Binding> {
  const bindings = new Map<string, Binding>();
  if (!ts.isBlock(fn.body)) return bindings;
  forEachNode(fn.body, (node) => {
    if (!ts.isVariableDeclaration(node) || !node.initializer) return;
    const spec = importedSpecifier(node.initializer);
    if (spec === null) return;
    const path = resolve(spec);
    if (ts.isIdentifier(node.name)) bindings.set(node.name.text, { path, name: null });
    else if (ts.isObjectBindingPattern(node.name))
      for (const element of node.name.elements) {
        if (!ts.isIdentifier(element.name)) continue;
        const imported = element.propertyName ?? element.name;
        if (ts.isIdentifier(imported))
          bindings.set(element.name.text, { path, name: imported.text });
      }
  });
  return bindings;
}

const allows = (owners: Owners, path: string, name: string) => {
  const names = owners.get(path);
  return names === 'any' || (names !== undefined && names.has(name));
};

function isTypedCall(
  expression: ts.Expression,
  owners: Owners,
  bindings: Map<string, Binding>,
  resolve: (spec: string) => string,
): boolean {
  const call = awaited(expression);
  if (!ts.isCallExpression(call)) return false;
  const callee = unwrap(call.expression);
  if (ts.isCallExpression(callee)) return isTypedCall(callee, owners, bindings, resolve);
  if (ts.isPropertyAccessExpression(callee)) {
    const spec = importedSpecifier(callee.expression);
    if (spec !== null) return allows(owners, resolve(spec), callee.name.text);
    const base = unwrap(callee.expression);
    if (ts.isIdentifier(base)) {
      const bound = bindings.get(base.text);
      return (
        bound !== undefined && bound.name === null && allows(owners, bound.path, callee.name.text)
      );
    }
    return false;
  }
  if (ts.isIdentifier(callee)) {
    const bound = bindings.get(callee.text);
    return bound !== undefined && bound.name !== null && allows(owners, bound.path, bound.name);
  }
  return false;
}

function ownersOf(facts: TypedMockFacts): Map<string, ReadonlySet<string> | 'any'> {
  const owners = new Map<string, ReadonlySet<string> | 'any'>();
  for (const fake of facts.fakes) owners.set(fake.owner, 'any');
  for (const helper of facts.typedHelpers) {
    const already = owners.get(helper.owner);
    if (already === 'any') continue;
    owners.set(helper.owner, new Set([...(already ?? []), ...helper.names]));
  }
  return owners;
}

function ownerFiles(facts: TypedMockFacts): Set<string> {
  return new Set([
    ...facts.fakes.map((fake) => fake.owner),
    ...facts.typedHelpers.map((h) => h.owner),
  ]);
}

function checkTyped(reader: RepoReader, facts: TypedMockFacts, files: FileView[]): Finding[] {
  const findings: Finding[] = [];
  const aliases = aliasList(facts.importAliases);
  const owners = ownersOf(facts);
  const skip = ownerFiles(facts);
  for (const owner of skip)
    if (!reader.exists(owner))
      findings.push({ file: owner, detail: 'this typed fake or helper file no longer exists' });
  for (const file of files) {
    if (skip.has(file.path)) continue;
    const resolve = (spec: string) => resolveSpecifier(reader, file.path, spec, aliases);
    for (const site of sitesOf(reader, file, aliases)) {
      if (!site.factory) continue;
      const fn = factoryFunction(site.factory);
      const returned = fn ? returnedExpression(fn) : null;
      if (fn && returned && isTypedCall(returned, owners, bindingsOf(fn, resolve), resolve))
        continue;
      findings.push({
        file: file.path,
        line: lineOfNode(file, site.node),
        detail:
          `mocks ${site.module} with a factory the type checker never compares to the module — return it through ` +
          "the module's shared fake or a typed mock helper, so every override has the module's own type",
      });
    }
  }
  return findings;
}

function overriddenNames(factory: ts.Expression): Array<{ name: string; node: ts.Node }> {
  const out: Array<{ name: string; node: ts.Node }> = [];
  forEachNode(factory, (node) => {
    if (
      (ts.isPropertyAssignment(node) ||
        ts.isShorthandPropertyAssignment(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isGetAccessorDeclaration(node)) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name))
    )
      out.push({ name: node.name.text, node });
  });
  return out;
}

function checkForbidden(reader: RepoReader, facts: TypedMockFacts, files: FileView[]): Finding[] {
  const findings: Finding[] = [];
  const aliases = aliasList(facts.importAliases);
  const byModule = new Map(facts.forbiddenOverrides.map((entry) => [entry.module, entry]));
  for (const file of files) {
    for (const site of sitesOf(reader, file, aliases)) {
      const entry = byModule.get(site.module);
      if (!entry || !site.factory) continue;
      const forbidden = new Set(entry.names);
      for (const { name, node } of overriddenNames(site.factory)) {
        if (!forbidden.has(name)) continue;
        findings.push({
          file: file.path,
          line: lineOfNode(file, node),
          detail: `overrides ${site.module}'s ${name} — the real one runs in every test: ${entry.why}`,
        });
      }
    }
  }
  return findings;
}

function factProblems(facts: TypedMockFacts): string[] {
  const problems: string[] = [];
  if (!objectProblem(facts, 'the facts', problems)) return problems;
  importAliasesProblem(facts.importAliases, 'importAliases', problems);
  if (!Array.isArray(facts.fakes))
    problems.push('fakes is missing (declare [] when there is none)');
  else
    for (const fake of facts.fakes as unknown[]) {
      const entry = (fake && typeof fake === 'object' ? fake : {}) as Record<string, unknown>;
      textProblem(entry.module, 'an entry of fakes’ module', problems);
      pathProblem(entry.owner, `fakes entry ${String(entry.module)}'s owner`, problems);
    }
  if (!Array.isArray(facts.typedHelpers))
    problems.push('typedHelpers is missing (declare [] when there is none)');
  else
    for (const helper of facts.typedHelpers as unknown[]) {
      const entry = (helper && typeof helper === 'object' ? helper : {}) as Record<string, unknown>;
      pathProblem(entry.owner, "a typedHelpers entry's owner", problems);
      namesProblem(entry.names, `typedHelpers entry ${String(entry.owner)}'s names`, problems);
    }
  if (!Array.isArray(facts.forbiddenOverrides))
    problems.push('forbiddenOverrides is missing (declare [] when there is none)');
  else {
    const seen = new Set<string>();
    for (const raw of facts.forbiddenOverrides as unknown[]) {
      const entry = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      if (!isText(entry.module)) {
        problems.push('an entry of forbiddenOverrides names no module');
        continue;
      }
      if (seen.has(entry.module)) problems.push(`forbiddenOverrides lists ${entry.module} twice`);
      seen.add(entry.module);
      namesProblem(entry.names, `forbiddenOverrides entry ${entry.module}'s names`, problems);
      textProblem(entry.why, `forbiddenOverrides entry ${entry.module}'s why`, problems);
    }
  }
  return problems;
}

export const typedMockGuard: GenericGuardDefinition<TypedMockFacts> = {
  id: 'typedMocks',
  absentWhen: false,
  factProblems,
  build(facts) {
    return [
      {
        title: 'every module mock is typed against the module it replaces',
        description:
          "A test's module mock returns its module through the module's shared fake or a typed mock helper, so every " +
          "override is checked against the module's own type. A factory that returns a hand-written object is never " +
          'compared to the module, so a double that no longer matches it still passes. A mock with no factory is ' +
          'the runner’s own automock and passes.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run(context) {
          return checkTyped(context.reader, facts, context.files(SCOPE));
        },
      },
      {
        title: 'no test overrides an export whose real behavior every test needs',
        description:
          'A listed export is never replaced in a test, by its shared fake’s overrides or by a factory of its own: ' +
          'a stand-in that behaves differently on the path a case proves lets the case pass on behavior the app ' +
          'never has. Each entry names its module, the exports, and why the real one runs.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run(context) {
          return checkForbidden(context.reader, facts, context.files(SCOPE));
        },
      },
    ];
  },
};
