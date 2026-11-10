import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { LIVE_BY_CONSTRUCTION, type FileView } from '@ttt-productions/repo-guards';
import { packageSource, workspacePackages } from './workspace';

const QUERY_CORE_REACT = '@ttt-productions/query-core/react';
const LIVE_ONLY_PRIMITIVES: ReadonlySet<string> = new Set(['useFirestoreLiveInfinite']);
const FIRESTORE_SDK = /^firebase\/firestore(?:\/|$)/;

// The package-internal onSnapshot sites that open a listener only for a consumer that passed
// `subscribe`: they do not make the code that reaches them live.
const CONDITIONAL_SNAPSHOT_SITES = [
  {
    file: 'packages/query-core/src/react/firestore/live-read-registry.ts',
    unit: 'collectionTarget',
    why: 'the collection target listens only once a mount that passed subscribe acquires it',
  },
  {
    file: 'packages/query-core/src/react/firestore/live-read-registry.ts',
    unit: 'docTarget',
    why: 'the document target listens only once a mount that passed subscribe acquires it',
  },
  {
    file: 'packages/query-core/src/react/firestore/doc-subscription-registry.ts',
    unit: 'subscribeDoc',
    why: 'the batch document reader calls it only for a read that passed subscribe',
  },
];

interface Unit {
  file: string;
  name: string;
  node: ts.Node;
  live: string | null;
  refs: Array<{ file: string; name: string } | { live: string }>;
}

const files = new Map(packageSource(['code']).map((file) => [file.path, file]));

function resolveRelative(from: string, spec: string): string | null {
  const base = path.posix.join(path.posix.dirname(from), spec).replace(/\.js$/, '');
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`])
    if (files.has(candidate)) return candidate;
  return null;
}

function inTypePosition(node: ts.Node): boolean {
  for (let up = node.parent; up && !ts.isSourceFile(up); up = up.parent)
    if (ts.isTypeNode(up) || ts.isImportDeclaration(up) || ts.isExportDeclaration(up)) return true;
  return false;
}

function isReference(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if ((ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent)) && parent.name === node)
    return false;
  if (ts.isVariableDeclaration(parent) && parent.name === node) return false;
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return false;
  return !inTypePosition(node);
}

function unitsOf(file: FileView): Unit[] {
  const source = file.sourceFile;
  const bindings = new Map<string, { file: string; name: string } | { live: string }>();
  const snapshotNames = new Set<string>();
  const sdkNamespaces = new Set<string>();
  for (const site of file.imports) {
    if (site.kind !== 'import' || !site.topLevel || site.typeOnly) continue;
    if (FIRESTORE_SDK.test(site.spec)) {
      if (site.namespace) sdkNamespaces.add(site.namespace);
      for (const name of site.named)
        if (name.imported === 'onSnapshot') snapshotNames.add(name.local);
      continue;
    }
    for (const name of site.named) {
      if (name.typeOnly) continue;
      if (site.spec.startsWith('.')) {
        const target = resolveRelative(file.path, site.spec);
        if (target) bindings.set(name.local, { file: target, name: name.imported });
      } else if (site.spec === QUERY_CORE_REACT && LIVE_ONLY_PRIMITIVES.has(name.imported)) {
        bindings.set(name.local, { live: `${name.imported} from ${site.spec}` });
      } else if (
        LIVE_BY_CONSTRUCTION.some((l) => l.entry === site.spec && l.export === name.imported)
      ) {
        bindings.set(name.local, { live: `${name.imported} from ${site.spec}` });
      }
    }
  }
  const queryCoreReads = new Set(
    file.imports
      .filter((site) => site.kind === 'import' && site.spec === QUERY_CORE_REACT)
      .flatMap((site) => site.named.map((n) => n.local)),
  );

  const units: Unit[] = [];
  for (const statement of source.statements) {
    const named: Array<[string, ts.Node]> = [];
    if (ts.isFunctionDeclaration(statement) && statement.name)
      named.push([statement.name.text, statement]);
    else if (ts.isClassDeclaration(statement) && statement.name)
      named.push([statement.name.text, statement]);
    else if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name)) named.push([declaration.name.text, declaration]);
    for (const [name, node] of named)
      units.push({ file: file.path, name, node, live: null, refs: [] });
  }
  const local = new Set(units.map((u) => u.name));

  for (const unit of units) {
    const reviewed = CONDITIONAL_SNAPSHOT_SITES.some(
      (s) => s.file === unit.file && s.unit === unit.name,
    );
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const snapshot =
          (ts.isIdentifier(callee) && snapshotNames.has(callee.text)) ||
          (ts.isPropertyAccessExpression(callee) &&
            ts.isIdentifier(callee.expression) &&
            sdkNamespaces.has(callee.expression.text) &&
            callee.name.text === 'onSnapshot');
        if (snapshot && !reviewed) unit.live ??= `onSnapshot in ${unit.file}`;
        if (ts.isIdentifier(callee) && queryCoreReads.has(callee.text))
          for (const argument of node.arguments)
            if (
              ts.isObjectLiteralExpression(argument) &&
              argument.properties.some(
                (p) =>
                  ts.isPropertyAssignment(p) &&
                  ts.isIdentifier(p.name) &&
                  p.name.text === 'subscribe' &&
                  p.initializer.kind === ts.SyntaxKind.TrueKeyword,
              )
            )
              unit.live ??= `subscribe: true passed to ${callee.text} in ${unit.file}`;
      }
      if (ts.isIdentifier(node) && node !== unit.node && isReference(node)) {
        const bound = bindings.get(node.text);
        if (bound) unit.refs.push(bound);
        else if (local.has(node.text) && node.text !== unit.name)
          unit.refs.push({ file: unit.file, name: node.text });
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(unit.node, visit);
  }
  return units;
}

const units = [...files.values()].flatMap(unitsOf);
const unitByKey = new Map(units.map((u) => [`${u.file}#${u.name}`, u]));

for (let changed = true; changed;) {
  changed = false;
  for (const unit of units) {
    if (unit.live) continue;
    for (const ref of unit.refs) {
      const reason =
        'live' in ref ? ref.live : (unitByKey.get(`${ref.file}#${ref.name}`)?.live ?? null);
      if (reason) {
        unit.live = `reaches ${'live' in ref ? ref.live : `${ref.name} (${reason})`}`;
        changed = true;
        break;
      }
    }
  }
}

interface Manifest {
  name?: string;
  exports?: Record<string, unknown>;
}

function entryIndexes(): Array<{ entry: string; file: string }> {
  const out: Array<{ entry: string; file: string }> = [];
  for (const { dir, manifest } of workspacePackages<Manifest>()) {
    if (!manifest.name) continue;
    for (const [subpath, target] of Object.entries(manifest.exports ?? { '.': {} })) {
      const types =
        typeof target === 'object' && target !== null
          ? (target as { types?: unknown }).types
          : undefined;
      const built =
        typeof types === 'string' ? types : subpath === '.' ? './dist/index.d.ts' : null;
      if (!built || !built.startsWith('./dist/')) continue;
      const stem = `packages/${dir}/src/${built.slice('./dist/'.length).replace(/\.d\.ts$/, '')}`;
      const file = [`${stem}.ts`, `${stem}.tsx`].find((f) => files.has(f));
      if (file)
        out.push({
          entry: subpath === '.' ? manifest.name : `${manifest.name}${subpath.slice(1)}`,
          file,
        });
    }
  }
  return out;
}

function exportsOf(index: string): Array<{ name: string; file: string; imported: string }> {
  const out: Array<{ name: string; file: string; imported: string }> = [];
  for (const statement of files.get(index)!.sourceFile.statements) {
    if (!ts.isExportDeclaration(statement) || statement.isTypeOnly) continue;
    const spec = statement.moduleSpecifier;
    if (!spec || !ts.isStringLiteral(spec) || !statement.exportClause) continue;
    if (!ts.isNamedExports(statement.exportClause)) continue;
    const target = resolveRelative(index, spec.text);
    if (!target) continue;
    for (const element of statement.exportClause.elements) {
      if (element.isTypeOnly) continue;
      out.push({
        name: element.name.text,
        file: target,
        imported: (element.propertyName ?? element.name).text,
      });
    }
  }
  return out;
}

const indexes = entryIndexes();
const exported = indexes.flatMap(({ entry, file }) =>
  exportsOf(file).map((e) => ({
    entry,
    export: e.name,
    live: unitByKey.get(`${e.file}#${e.imported}`)?.live ?? null,
  })),
);
const key = (e: { entry: string; export: string }) => `${e.export} from ${e.entry}`;

describe('boundary: every package export that always subscribes is on the live-by-construction list', () => {
  it('reads every package source file and every package entry', () => {
    expect(files.size).toBeGreaterThan(100);
    expect(indexes.length).toBeGreaterThan(30);
  });

  it('lists every export that opens a live read whatever its caller passes', () => {
    const listed = new Set(LIVE_BY_CONSTRUCTION.map(key));
    const missing = exported.filter((e) => e.live && !listed.has(key(e)));
    expect(
      missing.map((e) => `${key(e)}: ${e.live}`),
      "add each to repo-guards' LIVE_BY_CONSTRUCTION, so an app's use of it is a reviewed live read",
    ).toEqual([]);
  });

  it('lists no export that is gone or no longer always live', () => {
    const live = new Set(exported.filter((e) => e.live).map(key));
    const stale = LIVE_BY_CONSTRUCTION.filter((l) => !live.has(key(l)));
    expect(
      stale.map(key),
      "remove each from repo-guards' LIVE_BY_CONSTRUCTION: its entry no longer exports it, or it no longer subscribes on its own",
    ).toEqual([]);
  });

  it('keeps each reviewed conditional onSnapshot site', () => {
    const gone = CONDITIONAL_SNAPSHOT_SITES.filter((site) => {
      const unit = unitByKey.get(`${site.file}#${site.unit}`);
      if (!unit) return true;
      let found = false;
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'onSnapshot'
        )
          found = true;
        else ts.forEachChild(node, visit);
      };
      visit(unit.node);
      return !found;
    });
    expect(
      gone.map((s) => `${s.file} ${s.unit}`),
      'a reviewed site that no longer calls onSnapshot is stale: remove it from the list',
    ).toEqual([]);
  });
});
