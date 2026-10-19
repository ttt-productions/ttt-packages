// Report only, run by hand — never a gate: "are these two exports the same concept?" is a semantic
// judgment. It lists every exported name DEFINED in more than one module of the app root or of the
// Functions root, and every value name defined on both sides of that boundary. A re-export is never
// a definition: `export { x } from './y'` and the two-statement `import { x } …; export { x }` surface
// a definition that lives elsewhere, and counting them would bury the real duplicates.

import ts from 'typescript';
import type { RepoReader, Scope } from '../../node/reader.js';
import type { FileView } from '../../reader/view.js';
import { moduleImports } from '../../support/imports.js';

export interface DuplicateExportFacts {
  /**
   * Shared names reviewed and deliberately kept, with the files they may appear in. A group stays
   * quiet only while every file it appears in is listed; a copy in any other file reports.
   */
  knownLegit: Readonly<Record<string, { files: readonly string[]; why: string }>>;
  /** Exports a framework requires of every module under a path (route handlers, page config). */
  frameworkReservedExports: ReadonlyArray<{ pathPrefix: string; names: readonly string[]; why: string }>;
}

const hasExport = (node: ts.Node) =>
  ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/** The value and type names a module defines and exports — re-exports excluded. */
export function definedExports(file: FileView): { values: Set<string>; types: Set<string> } {
  const sf = file.sourceFile;
  const values = new Set<string>();
  const types = new Set<string>();
  const imported = new Set<string>();
  for (const site of moduleImports(sf, ['import'])) {
    if (!site.topLevel) continue;
    if (site.defaultName) imported.add(site.defaultName);
    if (site.namespace) imported.add(site.namespace);
    for (const { local } of site.named) imported.add(local);
  }
  const addBinding = (name: ts.BindingName, bucket: Set<string>) => {
    if (ts.isIdentifier(name)) bucket.add(name.text);
    else for (const el of name.elements) if (ts.isBindingElement(el)) addBinding(el.name, bucket);
  };
  for (const stmt of sf.statements) {
    if (ts.isVariableStatement(stmt) && hasExport(stmt)) {
      for (const d of stmt.declarationList.declarations) addBinding(d.name, values);
    } else if ((ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt) || ts.isEnumDeclaration(stmt)) && hasExport(stmt)) {
      values.add(stmt.name ? stmt.name.text : 'default');
    } else if ((ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt)) && hasExport(stmt)) {
      types.add(stmt.name.text);
    } else if (ts.isExportDeclaration(stmt)) {
      const from = !!stmt.moduleSpecifier;
      const bucket = stmt.isTypeOnly ? types : values;
      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) {
          const local = (el.propertyName ?? el.name).text;
          if (!from && !imported.has(local)) (el.isTypeOnly ? types : bucket).add(el.name.text);
        }
      } else if (from && stmt.exportClause && ts.isNamespaceExport(stmt.exportClause)) {
        // `export * as ns from` binds a new namespace name of its own.
        bucket.add(stmt.exportClause.name.text);
      }
    } else if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) {
      values.add('default');
    }
  }
  return { values, types };
}

export interface DuplicateGroup {
  name: string;
  files: string[];
  /** Files outside a reviewed group's listed set; empty for a name nobody reviewed. */
  unexpected: string[];
  /** The reviewed why, when a reviewed group gained a copy. */
  why?: string;
}

export interface DuplicateExportResult {
  appValues: DuplicateGroup[];
  functionsValues: DuplicateGroup[];
  appTypes: DuplicateGroup[];
  functionsTypes: DuplicateGroup[];
  crossTree: DuplicateGroup[];
  suppressed: number;
  modules: number;
}

/** The analysis over a set of modules, split into the app tree and the Functions tree by role. */
export function analyzeDuplicateExports(files: readonly FileView[], facts: DuplicateExportFacts): DuplicateExportResult {
  const trees = {
    app: { values: new Map<string, string[]>(), types: new Map<string, string[]>() },
    functions: { values: new Map<string, string[]>(), types: new Map<string, string[]>() },
  };
  const add = (map: Map<string, string[]>, name: string, path: string) => map.set(name, [...(map.get(name) ?? []), path]);
  for (const file of files) {
    const tree = file.role === 'functions' ? trees.functions : trees.app;
    const { values, types } = definedExports(file);
    for (const name of values) {
      if (name === 'default') continue;
      if (facts.frameworkReservedExports.some((r) => file.path.startsWith(r.pathPrefix) && r.names.includes(name))) continue;
      add(tree.values, name, file.path);
    }
    for (const name of types) add(tree.types, name, file.path);
  }

  let suppressed = 0;
  const classify = (name: string, paths: string[]): DuplicateGroup | null => {
    const files = [...new Set(paths)];
    const known = facts.knownLegit[name];
    if (!known) return { name, files, unexpected: [] };
    const unexpected = files.filter((f) => !known.files.includes(f));
    if (!unexpected.length) {
      suppressed += 1;
      return null;
    }
    return { name, files, unexpected, why: known.why };
  };
  const dupes = (map: Map<string, string[]>) =>
    [...map.entries()]
      .filter(([, paths]) => new Set(paths).size > 1)
      .sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))
      .map(([name, paths]) => classify(name, paths))
      .filter((g): g is DuplicateGroup => g !== null);

  const result: DuplicateExportResult = {
    appValues: dupes(trees.app.values),
    functionsValues: dupes(trees.functions.values),
    appTypes: dupes(trees.app.types),
    functionsTypes: dupes(trees.functions.types),
    crossTree: [],
    suppressed: 0,
    modules: files.length,
  };
  for (const name of [...trees.app.values.keys()].filter((n) => trees.functions.values.has(n)).sort()) {
    const group = classify(name, [...trees.app.values.get(name)!, ...trees.functions.values.get(name)!]);
    if (group) result.crossTree.push(group);
  }
  result.suppressed = suppressed;
  return result;
}

/** The printable report. */
export function formatDuplicateExports(result: DuplicateExportResult): string {
  const lines: string[] = [];
  const section = (label: string, groups: DuplicateGroup[]) => {
    lines.push('', `== ${label}: ${groups.length} to review ==`);
    for (const { name, files, unexpected, why } of groups) {
      lines.push(`  ${name}${why ? '  [REVIEWED ENTRY CHANGED — a new copy appeared]' : ''}`);
      for (const f of files) lines.push(`    - ${f}${unexpected.includes(f) ? '   <-- not in the reviewed set' : ''}`);
      if (why) lines.push(`    reviewed why: ${why}`);
    }
  };
  section('app root duplicate value exports', result.appValues);
  section('Functions root duplicate value exports', result.functionsValues);
  section('app root duplicate type exports', result.appTypes);
  section('Functions root duplicate type exports', result.functionsTypes);
  section('value exports defined on both sides of the app / Functions boundary', result.crossTree);
  const total =
    result.appValues.length + result.functionsValues.length + result.appTypes.length + result.functionsTypes.length + result.crossTree.length;
  lines.push(
    '',
    total === 0
      ? `CLEAN — no unreviewed duplicate exports across ${result.modules} modules (${result.suppressed} reviewed group(s) quiet).`
      : `${total} name(s) to review across ${result.modules} modules (${result.suppressed} reviewed group(s) quiet). Consolidate each onto its ` +
          'canonical owner, or add a reviewed entry with its why. This report never fails a build.',
  );
  return lines.join('\n').trimStart();
}

const SCOPE: Scope = { roots: ['app', 'functions'], kinds: ['code'], tests: false, optionalRoots: ['functions'] };

/** Runs the report over the app and Functions roots the reader's layout declares. */
export function duplicateExportsReport(reader: RepoReader, facts: DuplicateExportFacts): { text: string; result: DuplicateExportResult } {
  const result = analyzeDuplicateExports(reader.files(SCOPE), facts);
  return { text: formatDuplicateExports(result), result };
}
