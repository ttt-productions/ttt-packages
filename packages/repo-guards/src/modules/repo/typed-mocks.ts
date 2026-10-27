import ts from 'typescript';
import { join } from 'node:path';
import type { Finding } from '../../guard.js';
import type { RepoReader, Scope } from '../../node/reader.js';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { FileView } from '../../reader/view.js';
import { lineOfNode, unwrap } from '../../support/ast.js';
import {
  awaited,
  bindingsOf,
  calledExport,
  factoryFunction,
  isRunnerOptions,
  parameterName,
  returnedExpressions,
  type Binding,
  type Factory,
} from '../../support/mock-factories.js';
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

export interface FakeCall {
  name: string;
  overridesArgument: number;
}

export interface ForbiddenOverride {
  module: string;
  names: readonly string[];
  why: string;
  fakeCalls?: readonly FakeCall[];
}

export interface BuiltOverride {
  module: string;
  names: readonly string[];
  builders: TypedMockHelper;
  why: string;
}

export interface TypedMockFacts {
  importAliases: Readonly<Record<string, string>>;
  fakes: readonly SharedFake[];
  typedHelpers: readonly TypedMockHelper[];
  forbiddenOverrides: readonly ForbiddenOverride[];
  builtOverrides: readonly BuiltOverride[];
}

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

type OwnerKind = 'fake' | 'helper';
type Owners = ReadonlyMap<
  string,
  { kind: 'fake' } | { kind: 'helper'; names: ReadonlySet<string> }
>;

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
  const target = calledExport(call, bindings, resolve);
  return target ? ownerKind(owners, target.path, target.name) : null;
}

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

function calleeName(call: ts.CallExpression): string | null {
  const callee = unwrap(call.expression);
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return null;
}

function overridesOf(
  returned: ts.Expression,
  original: string | null,
  fakeCalls: ReadonlyMap<string, number>,
): OverrideRead[] {
  const value = awaited(returned);
  const objects: ts.ObjectLiteralExpression[] = [];
  const out: OverrideRead[] = [];
  const name = ts.isCallExpression(value) ? calleeName(value) : null;
  const overridesAt = name === null ? undefined : fakeCalls.get(name);
  if (ts.isObjectLiteralExpression(value)) objects.push(value);
  else if (ts.isCallExpression(value) && overridesAt !== undefined) {
    const argument = value.arguments[overridesAt];
    if (argument) {
      const arg = unwrap(argument);
      if (ts.isObjectLiteralExpression(arg)) objects.push(arg);
      else out.push({ unread: arg });
    }
  } else if (ts.isCallExpression(value))
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
      const fakeCalls = new Map(
        (entry.fakeCalls ?? []).map((call) => [call.name, call.overridesArgument]),
      );
      for (const returned of returnedExpressions(fn)) {
        if (!returned) continue;
        for (const read of overridesOf(returned, parameterName(fn), fakeCalls)) {
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

function fileBindings(file: FileView, resolve: (spec: string) => string): Map<string, Binding> {
  const bindings = new Map<string, Binding>();
  for (const site of file.imports) {
    if (site.kind !== 'import' || !site.topLevel || site.typeOnly) continue;
    const path = resolve(site.spec);
    if (site.namespace) bindings.set(site.namespace, { path, name: null });
    for (const named of site.named)
      if (!named.typeOnly) bindings.set(named.local, { path, name: named.imported });
  }
  return bindings;
}

const overrideFunction = (node: ts.Node): Factory | null =>
  ts.isPropertyAssignment(node) ? factoryFunction(node.initializer) : null;

function holderValues(file: FileView, holder: string): ts.Expression[] {
  const values: ts.Expression[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      unwrap(node.left).getText(file.sourceFile) === holder
    )
      values.push(node.right);
    else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === holder &&
      node.initializer
    )
      values.push(node.initializer);
    ts.forEachChild(node, visit);
  };
  visit(file.sourceFile);
  return values;
}

function checkBuilt(reader: RepoReader, facts: TypedMockFacts, files: FileView[]): Finding[] {
  const findings: Finding[] = [];
  const aliases = aliasList(facts.importAliases);
  const byModule = new Map(facts.builtOverrides.map((entry) => [entry.module, entry]));
  for (const entry of facts.builtOverrides) {
    const missing = missingOwner(reader, entry.builders.owner);
    if (missing) findings.push({ file: entry.builders.owner, detail: missing });
  }
  for (const file of files) {
    const resolve = (spec: string) => resolveSpecifier(reader, file.path, spec, aliases);
    const atFile = fileBindings(file, resolve);
    for (const site of sitesOf(reader, file, aliases)) {
      const entry = byModule.get(site.module);
      if (!entry || !site.factory || isRunnerOptions(site.factory)) continue;
      const fn = factoryFunction(site.factory);
      if (!fn) continue;
      const bindings = new Map([...atFile, ...bindingsOf(fn, resolve)]);
      const listed = new Set(entry.names);
      const builders = new Set(entry.builders.names);
      const builderList = entry.builders.names.join(' / ');
      const builds = (value: ts.Expression): boolean => {
        const call = awaited(value);
        if (!ts.isCallExpression(call)) return false;
        const target = calledExport(call, bindings, resolve);
        return target?.path === entry.builders.owner && builders.has(target.name);
      };
      const report = (node: ts.Node, why: string) =>
        findings.push({
          file: file.path,
          line: lineOfNode(file, node),
          detail: `overrides ${site.module}'s ${why} — ${entry.why}`,
        });
      for (const returned of returnedExpressions(fn)) {
        if (!returned) continue;
        for (const read of overridesOf(returned, parameterName(fn), new Map())) {
          if ('unread' in read) {
            findings.push({
              file: file.path,
              line: lineOfNode(file, read.unread),
              detail: `overrides ${site.module} through names the guard cannot read — write each override by name, since ${entry.names.join(', ')} must return a listed builder: ${entry.why}`,
            });
            continue;
          }
          if (!listed.has(read.name)) continue;
          const override = overrideFunction(read.node);
          if (!override) {
            report(read.node, `${read.name} with something other than a function written there`);
            continue;
          }
          for (const value of returnedExpressions(override)) {
            if (!value) {
              report(override, `${read.name} with a function that returns nothing`);
              continue;
            }
            if (builds(value)) continue;
            const holder = unwrap(value);
            if (!ts.isIdentifier(holder) && !ts.isPropertyAccessExpression(holder)) {
              report(value, `${read.name} with a value that is no ${builderList} call`);
              continue;
            }
            const name = holder.getText(file.sourceFile);
            const assigned = holderValues(file, name);
            if (!assigned.length)
              report(value, `${read.name} with ${name}, which nothing in the file sets`);
            for (const set of assigned)
              if (!builds(set))
                report(
                  set,
                  `${read.name} through ${name}, set to a value that is no ${builderList} call`,
                );
          }
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
      if (entry.fakeCalls === undefined) continue;
      if (!Array.isArray(entry.fakeCalls)) {
        problems.push(`forbiddenOverrides entry ${entry.module}'s fakeCalls is not a list`);
        continue;
      }
      for (const call of entry.fakeCalls as unknown[]) {
        const fake = (call && typeof call === 'object' ? call : {}) as Record<string, unknown>;
        if (!isText(fake.name)) problems.push(`a fakeCalls entry of ${entry.module} names no fake`);
        if (
          typeof fake.overridesArgument !== 'number' ||
          !Number.isInteger(fake.overridesArgument) ||
          fake.overridesArgument < 1
        )
          problems.push(
            `fakeCalls entry ${String(fake.name)} of ${entry.module} needs overridesArgument, the position of its override object after importOriginal`,
          );
      }
    }
  }
  if (!Array.isArray(facts.builtOverrides))
    problems.push('builtOverrides is missing (declare [] when there is none)');
  else {
    const seen = new Set<string>();
    for (const raw of facts.builtOverrides as unknown[]) {
      const entry = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      if (!isText(entry.module)) {
        problems.push('an entry of builtOverrides names no module');
        continue;
      }
      if (seen.has(entry.module)) problems.push(`builtOverrides lists ${entry.module} twice`);
      seen.add(entry.module);
      namesProblem(entry.names, `builtOverrides entry ${entry.module}'s names`, problems);
      textProblem(entry.why, `builtOverrides entry ${entry.module}'s why`, problems);
      const builders = (
        entry.builders && typeof entry.builders === 'object' ? entry.builders : {}
      ) as Record<string, unknown>;
      pathProblem(
        builders.owner,
        `builtOverrides entry ${entry.module}'s builders owner`,
        problems,
      );
      namesProblem(builders.names, `builtOverrides entry ${entry.module}'s builders`, problems);
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
          'listed one. Each entry names its module, the exports, and why the real one runs. An entry may name ' +
          'its shared fake’s calls with the position of their override object: for a call to that fake only that ' +
          'argument is read, and the arguments before it are the fake’s state.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run(context) {
          return checkForbidden(context.reader, facts, context.files(SCOPE));
        },
      },
      {
        title: 'an override of a listed export returns one of its listed builders',
        description:
          'A listed export is replaced in a test only by a function written at the override whose every return ' +
          'is a call to one of its listed builders, or a holder — a name or a property — that every assignment in ' +
          'the file sets from one of them. A hand-written stand-in can claim a combination the real export never ' +
          'returns, so a case passes on a state the product never meets. The guard reads the names each override ' +
          'object sets at its top level; a spread of anything but the real module, a computed name, or an override ' +
          'object it cannot see fails, since it could hide a listed one. Each entry names its module, the exports, ' +
          'the builders’ owner and names, and why only the builders may stand in.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run(context) {
          return checkBuilt(context.reader, facts, context.files(SCOPE));
        },
      },
    ];
  },
};
