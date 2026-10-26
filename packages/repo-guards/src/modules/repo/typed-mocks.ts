import ts from 'typescript';
import { join } from 'node:path';
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
import { aliasList, isLocalModule, resolveSpecifier } from '../../support/resolve-specifier.js';
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

type Factory = ts.ArrowFunction | ts.FunctionExpression;

interface Site {
  node: ts.CallExpression;
  module: string;
  byImport: boolean;
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
      byImport: site.byImport,
      factory: site.node.arguments[1],
    });
  }
  return out;
}

function factoryFunction(factory: ts.Expression): Factory | null {
  const value = unwrap(factory);
  return ts.isArrowFunction(value) || ts.isFunctionExpression(value) ? value : null;
}

// The runner's options object (`{ spy: true }`) in the factory's place mocks the module itself.
const isRunnerOptions = (factory: ts.Expression): boolean =>
  ts.isObjectLiteralExpression(unwrap(factory));

function returnedExpressions(fn: Factory): Array<ts.Expression | null> {
  if (!ts.isBlock(fn.body)) return [fn.body];
  const out: Array<ts.Expression | null> = [];
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node)) out.push(node.expression ?? null);
    ts.forEachChild(node, visit);
  };
  fn.body.statements.forEach(visit);
  return out;
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

type OwnerKind = 'fake' | 'helper';
type Owners = ReadonlyMap<
  string,
  { kind: 'fake' } | { kind: 'helper'; names: ReadonlySet<string> }
>;

interface Binding {
  path: string;
  name: string | null;
}

function bindingsOf(fn: Factory, resolve: (spec: string) => string): Map<string, Binding> {
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

function ownerKind(owners: Owners, path: string, name: string): OwnerKind | null {
  const owner = owners.get(path);
  if (!owner) return null;
  if (owner.kind === 'fake') return 'fake';
  return owner.names.has(name) ? 'helper' : null;
}

function calleeKind(
  call: ts.CallExpression,
  owners: Owners,
  bindings: Map<string, Binding>,
  resolve: (spec: string) => string,
): OwnerKind | null {
  const callee = unwrap(call.expression);
  if (ts.isPropertyAccessExpression(callee)) {
    const spec = importedSpecifier(callee.expression);
    if (spec !== null) return ownerKind(owners, resolve(spec), callee.name.text);
    const base = unwrap(callee.expression);
    if (!ts.isIdentifier(base)) return null;
    const bound = bindings.get(base.text);
    return bound && bound.name === null ? ownerKind(owners, bound.path, callee.name.text) : null;
  }
  if (ts.isIdentifier(callee)) {
    const bound = bindings.get(callee.text);
    return bound && bound.name !== null ? ownerKind(owners, bound.path, bound.name) : null;
  }
  return null;
}

const parameterName = (fn: Factory): string | null => {
  const [first] = fn.parameters;
  return first && ts.isIdentifier(first.name) ? first.name.text : null;
};

function untypedReason(
  expression: ts.Expression | null,
  fn: Factory,
  owners: Owners,
  bindings: Map<string, Binding>,
  resolve: (spec: string) => string,
): string | null {
  const call = expression ? awaited(expression) : null;
  if (!call || !ts.isCallExpression(call))
    return 'returns something other than a shared fake or a typed mock helper';
  const kind = calleeKind(call, owners, bindings, resolve);
  if (!kind) return 'returns through a function that is no listed shared fake or typed mock helper';
  if (kind === 'fake') return null;
  if (call.typeArguments?.length)
    return 'writes the type of its typed mock helper instead of taking it from importOriginal';
  const original = parameterName(fn);
  const [first] = call.arguments;
  const passed = first ? unwrap(first) : null;
  if (!original || !passed || !ts.isIdentifier(passed) || passed.text !== original)
    return "hands its typed mock helper something other than the factory's own importOriginal";
  return null;
}

function ownersOf(facts: TypedMockFacts): Owners {
  const owners = new Map<
    string,
    { kind: 'fake' } | { kind: 'helper'; names: ReadonlySet<string> }
  >();
  for (const fake of facts.fakes) owners.set(fake.owner, { kind: 'fake' });
  for (const helper of facts.typedHelpers) {
    const already = owners.get(helper.owner);
    if (already?.kind === 'fake') continue;
    owners.set(helper.owner, {
      kind: 'helper',
      names: new Set([...(already?.names ?? []), ...helper.names]),
    });
  }
  return owners;
}

function ownerFiles(facts: TypedMockFacts): Set<string> {
  return new Set([
    ...facts.fakes.map((fake) => fake.owner),
    ...facts.typedHelpers.map((h) => h.owner),
  ]);
}

// A package-owned helper is named by its package entry (`@scope/pkg/testing`), not a repo file.
function missingOwner(reader: RepoReader, owner: string): string | null {
  if (isLocalModule(owner) || owner.startsWith('.'))
    return reader.exists(owner) ? null : 'this typed fake or helper file no longer exists';
  const segments = owner.split('/');
  const name = segments.slice(0, owner.startsWith('@') ? 2 : 1).join('/');
  const subpath = segments.slice(name.split('/').length).join('/');
  const manifest = reader.readOutside(
    join(reader.layout.repoRoot, 'node_modules', ...name.split('/'), 'package.json'),
  );
  if (manifest === null) return `no installed package ${name} holds this typed helper entry`;
  const exports: unknown = (JSON.parse(manifest) as { exports?: unknown }).exports;
  const key = subpath ? `./${subpath}` : '.';
  return exports && typeof exports === 'object' && key in exports
    ? null
    : `${name} exports no ${key} entry for this typed helper`;
}

function checkTyped(reader: RepoReader, facts: TypedMockFacts, files: FileView[]): Finding[] {
  const findings: Finding[] = [];
  const aliases = aliasList(facts.importAliases);
  const owners = ownersOf(facts);
  const skip = ownerFiles(facts);
  for (const owner of skip) {
    const missing = missingOwner(reader, owner);
    if (missing) findings.push({ file: owner, detail: missing });
  }
  for (const file of files) {
    if (skip.has(file.path)) continue;
    const resolve = (spec: string) => resolveSpecifier(reader, file.path, spec, aliases);
    for (const site of sitesOf(reader, file, aliases)) {
      const report = (node: ts.Node, why: string) =>
        findings.push({
          file: file.path,
          line: lineOfNode(file, node),
          detail: `mocks ${site.module} with a factory that ${why}`,
        });
      if (!site.byImport)
        findings.push({
          file: file.path,
          line: lineOfNode(file, site.node),
          detail:
            `mocks ${site.module} by a string path — name it through import('…'), so the factory's ` +
            "importOriginal carries the module's own type",
        });
      if (!site.factory || isRunnerOptions(site.factory)) continue;
      const fn = factoryFunction(site.factory);
      if (!fn) {
        report(site.node, 'the guard cannot read, since it is not written at the mock');
        continue;
      }
      const returns = returnedExpressions(fn);
      if (!returns.length) report(site.node, 'returns nothing');
      const bindings = bindingsOf(fn, resolve);
      for (const returned of returns) {
        const why = untypedReason(returned, fn, owners, bindings, resolve);
        if (why) report(returned ?? site.node, why);
      }
    }
  }
  return findings;
}

const isOriginalSpread = (expression: ts.Expression, original: string | null): boolean => {
  const value = awaited(expression);
  if (!ts.isCallExpression(value)) return false;
  const callee = unwrap(value.expression);
  return (
    (ts.isIdentifier(callee) && callee.text === original) ||
    (ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) &&
      callee.expression.text === 'vi' &&
      callee.name.text === 'importActual')
  );
};

type OverrideRead = { name: string; node: ts.Node } | { unread: ts.Node };

function overridesOf(returned: ts.Expression, original: string | null): OverrideRead[] {
  const value = awaited(returned);
  const objects: ts.ObjectLiteralExpression[] = [];
  const out: OverrideRead[] = [];
  if (ts.isObjectLiteralExpression(value)) objects.push(value);
  else if (ts.isCallExpression(value))
    for (const argument of value.arguments) {
      const arg = unwrap(argument);
      if (ts.isObjectLiteralExpression(arg)) objects.push(arg);
      else if (!(ts.isIdentifier(arg) && arg.text === original)) out.push({ unread: arg });
    }
  for (const object of objects)
    for (const property of object.properties) {
      if (ts.isSpreadAssignment(property)) {
        if (!isOriginalSpread(property.expression, original)) out.push({ unread: property });
        continue;
      }
      const name = property.name;
      if (name && (ts.isIdentifier(name) || ts.isStringLiteralLike(name)))
        out.push({ name: name.text, node: property });
      else out.push({ unread: property });
    }
  return out;
}

function checkForbidden(reader: RepoReader, facts: TypedMockFacts, files: FileView[]): Finding[] {
  const findings: Finding[] = [];
  const aliases = aliasList(facts.importAliases);
  const byModule = new Map(facts.forbiddenOverrides.map((entry) => [entry.module, entry]));
  for (const file of files) {
    for (const site of sitesOf(reader, file, aliases)) {
      const entry = byModule.get(site.module);
      if (!entry || !site.factory || isRunnerOptions(site.factory)) continue;
      const fn = factoryFunction(site.factory);
      if (!fn) continue;
      const forbidden = new Set(entry.names);
      for (const returned of returnedExpressions(fn)) {
        if (!returned) continue;
        for (const read of overridesOf(returned, parameterName(fn))) {
          if ('unread' in read) {
            findings.push({
              file: file.path,
              line: lineOfNode(file, read.unread),
              detail: `overrides ${site.module} through names the guard cannot read — write each override by name, since ${entry.names.join(', ')} must stay real: ${entry.why}`,
            });
            continue;
          }
          if (!forbidden.has(read.name)) continue;
          findings.push({
            file: file.path,
            line: lineOfNode(file, read.node),
            detail: `overrides ${site.module}'s ${read.name} — the real one runs in every test: ${entry.why}`,
          });
        }
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
          "A test's module mock names its module through `import('…')` and returns, on every path, through the " +
          "module's shared fake or a typed mock helper. A helper takes its module type from the factory's own " +
          '`importOriginal`, never from a type argument the test writes, so a wrong module, a misspelled export, ' +
          'and a wrong signature fail to compile. A factory that returns a hand-written object is never compared to ' +
          'the module, so a double that no longer matches it still passes. A mock with no factory, or with the ' +
          'runner’s options object (`{ spy: true }`) in its place, is the runner’s own and passes.',
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
          'never has. The guard reads the names each override object sets at its top level; a spread of anything ' +
          'but the real module, a computed name, or an override object it cannot see fails, since it could hide a ' +
          'listed one. Each entry names its module, the exports, and why the real one runs.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run(context) {
          return checkForbidden(context.reader, facts, context.files(SCOPE));
        },
      },
    ];
  },
};
