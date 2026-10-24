import ts from 'typescript';
import type { Finding } from '../../guard.js';
import { isTestPath } from '../../node/layout.js';
import type { RepoReader, Scope } from '../../node/reader.js';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { FileView } from '../../reader/view.js';
import { forEachNode, lineOfNode, unwrap } from '../../support/ast.js';
import { isText, objectProblem, pathProblem } from '../../support/facts.js';
import { aliasList, isLocalModule, resolveSpecifier } from '../../support/resolve-specifier.js';
import { REPOSITORY_GUARD_TIMEOUT_MS } from '../../support/timeouts.js';

const MOCK_CALLS: ReadonlySet<string> = new Set([
  'vi.mock',
  'vi.doMock',
  'jest.mock',
  'jest.doMock',
]);

const SCOPE: Scope = {
  roots: ['app', 'functions', 'scripts', 'workers'],
  kinds: ['code'],
  tests: 'only',
  optionalRoots: ['functions', 'scripts', 'workers'],
};

export interface SharedFake {
  module: string;
  owner: string;
}

export interface SharedFakeFacts {
  importAliases: Readonly<Record<string, string>>;
  fakes: readonly SharedFake[];
  helperOwners: readonly string[];
}

interface MockSite {
  node: ts.CallExpression;
  module: string;
  factory: ts.Expression | undefined;
  factoryLoads: string[];
}

function mockSites(
  reader: RepoReader,
  file: FileView,
  aliases: Array<[string, string]>,
): MockSite[] {
  const dynamic = file.imports.filter((site) => site.kind === 'dynamic');
  const out: MockSite[] = [];
  for (const site of file.imports) {
    if (site.kind !== 'mock' || !MOCK_CALLS.has(site.callee ?? '')) continue;
    const call = site.node as ts.CallExpression;
    const factory = call.arguments[1];
    const factoryLoads = factory
      ? dynamic
          .filter((load) => load.node.pos >= factory.pos && load.node.end <= factory.end)
          .map((load) => resolveSpecifier(reader, file.path, load.spec, aliases))
      : [];
    out.push({
      node: call,
      module: resolveSpecifier(reader, file.path, site.spec, aliases),
      factory,
      factoryLoads,
    });
  }
  return out;
}

const isFunctionValue = (node: ts.Expression | undefined) => {
  if (!node) return false;
  const value = unwrap(node);
  return ts.isArrowFunction(value) || ts.isFunctionExpression(value);
};

function helperDeclarations(file: FileView): Array<{ name: string; node: ts.Node }> {
  const out: Array<{ name: string; node: ts.Node }> = [];
  forEachNode(file.sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name) out.push({ name: node.name.text, node });
    else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      isFunctionValue(node.initializer)
    )
      out.push({ name: node.name.text, node });
  });
  return out;
}

const hasExportModifier = (node: ts.Node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

function exportedDeclarations(file: FileView): Set<string> {
  const names = new Set<string>();
  for (const statement of file.sourceFile.statements) {
    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      for (const d of statement.declarationList.declarations)
        if (ts.isIdentifier(d.name)) names.add(d.name.text);
    } else if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name &&
      hasExportModifier(statement)
    ) {
      names.add(statement.name.text);
    } else if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const el of statement.exportClause.elements) names.add(el.name.text);
    }
  }
  return names;
}

function ownerRoot(
  reader: RepoReader,
  path: string,
  what: string,
): { root?: string; problem?: string } {
  if (!reader.exists(path)) return { problem: `${what} ${path} no longer exists` };
  if (!isTestPath(reader.layout, path))
    return {
      problem: `${what} ${path} is not test code — a shared fake or helper lives with the tests`,
    };
  return { root: reader.file(path).rootName };
}

function checkFakes(reader: RepoReader, facts: SharedFakeFacts, files: FileView[]): Finding[] {
  const findings: Finding[] = [];
  const aliases = aliasList(facts.importAliases);
  const owners = new Map<string, Map<string, string>>();
  for (const fake of facts.fakes) {
    if (isLocalModule(fake.module) && !reader.exists(fake.module))
      findings.push({
        file: fake.owner,
        detail: `the faked module ${fake.module} no longer exists — drop its shared fake`,
      });
    const { root, problem } = ownerRoot(reader, fake.owner, 'the shared fake owner');
    if (problem) {
      findings.push({ file: fake.owner, detail: problem });
      continue;
    }
    const byModule = owners.get(root!) ?? new Map<string, string>();
    const already = byModule.get(fake.module);
    if (already && already !== fake.owner)
      findings.push({
        file: fake.owner,
        detail: `${fake.module} has two shared fakes in one tree (${already} and ${fake.owner}) — keep one`,
      });
    else byModule.set(fake.module, fake.owner);
    owners.set(root!, byModule);
  }
  const ownerFiles = new Set(facts.fakes.map((f) => f.owner));
  for (const file of files) {
    if (ownerFiles.has(file.path)) continue;
    const byModule = owners.get(file.rootName);
    if (!byModule) continue;
    for (const mock of mockSites(reader, file, aliases)) {
      const owner = byModule.get(mock.module);
      if (!owner || mock.factoryLoads.includes(owner)) continue;
      findings.push({
        file: file.path,
        line: lineOfNode(file, mock.node),
        detail: mock.factory
          ? `fakes ${mock.module} by hand — its fake is ${owner}: load it in the mock's factory and pass this test's overrides`
          : `fakes ${mock.module} with no factory — its fake is ${owner}: load it in the mock's factory`,
      });
    }
  }
  return findings;
}

function sharedHelpers(
  reader: RepoReader,
  facts: SharedFakeFacts,
  findings: Finding[] | null,
): Map<string, Map<string, string>> {
  const helpers = new Map<string, Map<string, string>>();
  for (const owner of facts.helperOwners) {
    const { root, problem } = ownerRoot(reader, owner, 'the shared helper file');
    if (problem) {
      findings?.push({ file: owner, detail: problem });
      continue;
    }
    const byName = helpers.get(root!) ?? new Map<string, string>();
    for (const name of exportedDeclarations(reader.file(owner))) byName.set(name, owner);
    helpers.set(root!, byName);
  }
  return helpers;
}

function checkHelpers(reader: RepoReader, facts: SharedFakeFacts, files: FileView[]): Finding[] {
  const findings: Finding[] = [];
  const helpers = sharedHelpers(reader, facts, findings);
  const ownerFiles = new Set([...facts.helperOwners, ...facts.fakes.map((f) => f.owner)]);
  for (const file of files) {
    if (ownerFiles.has(file.path)) continue;
    const byName = helpers.get(file.rootName);
    if (!byName) continue;
    for (const { name, node } of helperDeclarations(file)) {
      const owner = byName.get(name);
      if (owner)
        findings.push({
          file: file.path,
          line: lineOfNode(file, node),
          detail: `declares ${name}, which the shared helpers in ${owner} export — import it from there`,
        });
    }
  }
  return findings;
}

function factProblems(facts: SharedFakeFacts): string[] {
  const problems: string[] = [];
  if (!objectProblem(facts, 'the facts', problems)) return problems;
  if (objectProblem(facts.importAliases, 'importAliases', problems))
    for (const [prefix, folder] of Object.entries(facts.importAliases))
      if (!prefix || !isText(folder))
        problems.push(`importAliases ${prefix} needs a target folder`);
  if (!Array.isArray(facts.fakes))
    problems.push('fakes is missing (declare [] when there is none)');
  else {
    const seen = new Set<string>();
    for (const fake of facts.fakes as unknown[]) {
      const entry = (fake && typeof fake === 'object' ? fake : {}) as Record<string, unknown>;
      if (!isText(entry.module)) {
        problems.push('an entry of fakes names no module');
        continue;
      }
      const label = `fakes entry ${entry.module}`;
      if (isLocalModule(entry.module)) pathProblem(entry.module, `${label}'s module`, problems);
      pathProblem(entry.owner, `${label}'s owner`, problems);
      const key = `${entry.module}\0${String(entry.owner)}`;
      if (seen.has(key))
        problems.push(`fakes lists ${entry.module} with ${String(entry.owner)} twice`);
      seen.add(key);
    }
  }
  if (!Array.isArray(facts.helperOwners))
    problems.push('helperOwners is missing (declare [] when there is none)');
  else {
    const seen = new Set<string>();
    for (const owner of facts.helperOwners as unknown[]) {
      pathProblem(owner, 'a helperOwners entry', problems);
      if (isText(owner) && seen.has(owner)) problems.push(`helperOwners lists ${owner} twice`);
      if (isText(owner)) seen.add(owner);
    }
  }
  return problems;
}

export const sharedFakeGuard: GenericGuardDefinition<SharedFakeFacts> = {
  id: 'sharedFakes',
  absentWhen: false,
  factProblems,
  build(facts) {
    return [
      {
        title: 'a test fakes a module that has a shared fake only through that fake',
        description:
          'A module with a shared fake is faked through it alone: a test that needs its own behavior writes a mock whose ' +
          'factory loads the shared fake with import() and passes its overrides. A test that writes the fake out again, or ' +
          'mocks the module with no factory, is a second copy that drifts. A shared fake whose owner or module no longer ' +
          'exists, or that is not test code, fails too.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run(context) {
          return checkFakes(context.reader, facts, context.files(SCOPE));
        },
      },
      {
        title: 'a test never re-declares a helper the shared test helpers export',
        description:
          'A helper the shared test-helper files export is imported from there, never declared again in a test file of the ' +
          'same tree. A shared helper file that no longer exists, or that is not test code, fails too.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run(context) {
          return checkHelpers(context.reader, facts, context.files(SCOPE));
        },
      },
    ];
  },
};

export interface SharedFakeReport {
  modules: Array<{ root: string; module: string; files: string[] }>;
  helpers: Array<{ root: string; name: string; files: string[] }>;
}

export function sharedFakeReport(reader: RepoReader, facts: SharedFakeFacts): SharedFakeReport {
  const aliases = aliasList(facts.importAliases);
  const files = reader.files(SCOPE);
  const faked = new Set<string>();
  for (const fake of facts.fakes)
    if (reader.exists(fake.owner)) faked.add(`${reader.file(fake.owner).rootName}\0${fake.module}`);
  const helpers = sharedHelpers(reader, facts, null);
  const ownerFiles = new Set([...facts.helperOwners, ...facts.fakes.map((f) => f.owner)]);
  const moduleFiles = new Map<string, Set<string>>();
  const helperFiles = new Map<string, Set<string>>();
  const note = (map: Map<string, Set<string>>, key: string, path: string) =>
    map.set(key, (map.get(key) ?? new Set()).add(path));
  for (const file of files) {
    if (ownerFiles.has(file.path)) continue;
    for (const mock of mockSites(reader, file, aliases)) {
      const key = `${file.rootName}\0${mock.module}`;
      if (!faked.has(key)) note(moduleFiles, key, file.path);
    }
    for (const { name } of helperDeclarations(file))
      if (!helpers.get(file.rootName)?.has(name))
        note(helperFiles, `${file.rootName}\0${name}`, file.path);
  }
  const repeated = (map: Map<string, Set<string>>) =>
    [...map]
      .filter(([, paths]) => paths.size > 1)
      .map(([key, paths]) => {
        const [root, subject] = key.split('\0');
        return { root, subject, files: [...paths].sort() };
      })
      .sort(
        (a, b) =>
          b.files.length - a.files.length ||
          (a.root === b.root ? (a.subject < b.subject ? -1 : 1) : a.root < b.root ? -1 : 1),
      );
  return {
    modules: repeated(moduleFiles).map(({ root, subject, files: f }) => ({
      root,
      module: subject,
      files: f,
    })),
    helpers: repeated(helperFiles).map(({ root, subject, files: f }) => ({
      root,
      name: subject,
      files: f,
    })),
  };
}
