// The Firestore guards as the suite runs them, read through the one reader:
//   - the write guard: every field a local writer stores on a registered document is declared by
//     that document's schema in the app's core package (fails closed — see the analyzer);
//   - the test-code path guard: test code builds a Firestore path through the core, never by hand.

import path from 'node:path';
import type { Finding } from '../../guard.js';
import type { RepoReader } from '../../reader/reader.js';
import type { RootRole } from '../../reader/layout.js';
import type { GenericGuardDefinition } from '../../config.js';
import { listProblem, loaderProblem, namesProblem, objectProblem, reviewedProblems, textProblem, type Loader } from '../../support/facts.js';
import {
  analyzeFiles,
  createGuardProfile,
  enumerateWriteCallSites,
  evaluate,
  formatReport,
  loadRegistry,
  parseFile,
} from './analyzer.js';
import { findHandTypedFirestorePaths } from './test-paths.js';

export interface WriteGuardFacts {
  /** The app's core package specifier. Its installed build is the layout's `coreDist` root. */
  corePackage: string;
  importAliases: Readonly<Record<string, string>>;
  /** App types a write handle may be annotated with, beside Transaction / WriteBatch / BulkWriter. */
  transactionTypeNames: readonly string[];
  /** Module specifier prefixes whose exports can hand back a real Firestore handle. */
  handleModulePrefixes: readonly string[];
  removalOnlyTables: ReadonlyArray<{ exportName: string; module: string; label: string }>;
  /** The core's entry points, as loaders the app writes with literal specifiers. */
  registrySources: { core: Loader<Record<string, unknown>>; docSchemas: Loader<Record<string, unknown>>; subpaths?: Readonly<Record<string, Loader<Record<string, unknown>>>> };
  /** The core's path-constant maps the guard resolves names through. */
  constantMapNames: readonly string[];
  /** The roots that can write a document. */
  writerRoots: readonly RootRole[];
  /** One long-lived writer per writer root that the classifier must see writes in. */
  writerAnchors: readonly string[];
  /** The reviewed exceptions, each bound to a structural write site with its why. */
  exceptions: readonly Record<string, unknown>[];
}

export interface TestPathFacts {
  /** The core's declared collection names (usually `Object.values(COLLECTIONS)` loaded at run time). */
  collectionNames: () => readonly string[] | Promise<readonly string[]>;
}

/** Runs the write guard over the app's writer roots. Also the hand-run coverage report's engine. */
export async function runWriteGuard(reader: RepoReader, facts: WriteGuardFacts, read = reader.files.bind(reader)) {
  const coreDist = reader.layout.roots.coreDist;
  if (!coreDist) throw new Error('repo-guards: the write guard reads the core package build, and the layout declares no coreDist root');
  const profile = createGuardProfile({
    corePackage: facts.corePackage,
    coreLibraryRoot: coreDist.path,
    importAliases: { ...facts.importAliases },
    transactionTypeNames: [...facts.transactionTypeNames],
    handleModulePrefixes: [...facts.handleModulePrefixes],
    removalOnlyTables: facts.removalOnlyTables.map((t) => ({ ...t })),
  });
  const registry = await loadRegistry({ sources: facts.registrySources, constantMapNames: [...facts.constantMapNames] });
  const files = read({ roots: facts.writerRoots, kinds: ['code'], tests: false }).map((f) =>
    parseFile(f.path, f.text, { sourceFile: f.sourceFile }),
  );
  const libraryFiles = read({ roots: ['coreDist'], kinds: ['code'], tests: false }).map((f) =>
    parseFile(f.path, f.text, { library: true, sourceFile: f.sourceFile }),
  );
  const exceptions = facts.exceptions.map((e) => ({ ...e }));
  const packageDeclarations = (name: string) =>
    reader
      .installedFiles(name, { kinds: ['declarations'] })
      .map((v) => ({ file: path.join(reader.layout.repoRoot, v.path), text: v.text, sourceFile: v.sourceFile }));
  const { writes, notFirestore, unclassified, packageBuilderUses } = analyzeFiles({
    files,
    libraryFiles,
    registry,
    profile,
    exceptions,
    packageDeclarations,
  });
  const trees = facts.writerRoots.flatMap((role) => rootPaths(reader, role));
  const evaluated = evaluate({
    writes,
    registry,
    exceptions,
    trees,
    notFirestore,
    unclassified,
    packageBuilderUses,
    callSites: enumerateWriteCallSites(files),
  });
  return { ...evaluated, writes, notFirestore, unclassified, staleExclusions: [] as string[], fileCount: files.length };
}

function rootPaths(reader: RepoReader, role: RootRole): string[] {
  if (role === 'workers') return Object.values(reader.layout.roots.workers ?? {}).map((r) => r.path);
  const root = reader.layout.roots[role];
  return root ? [root.path] : [];
}

export const writeGuard: GenericGuardDefinition<WriteGuardFacts> = {
  id: 'firestoreWrites',
  absentWhen: 'the app stores nothing in Firestore',
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.corePackage, 'corePackage', problems);
    objectProblem(facts?.importAliases, 'importAliases', problems);
    namesProblem(facts?.transactionTypeNames, 'transactionTypeNames', problems, { nonEmpty: false });
    namesProblem(facts?.handleModulePrefixes, 'handleModulePrefixes', problems, { nonEmpty: false });
    listProblem(facts?.removalOnlyTables, 'removalOnlyTables', problems, { nonEmpty: false });
    namesProblem(facts?.constantMapNames, 'constantMapNames', problems);
    namesProblem(facts?.writerRoots, 'writerRoots', problems);
    namesProblem(facts?.writerAnchors, 'writerAnchors', problems);
    reviewedProblems(facts?.exceptions, 'exceptions', problems, {
      key: 'file',
      id: (e) => `${e.file} ${JSON.stringify(Object.entries(e).filter(([k]) => k !== 'file' && k !== 'why'))}`,
    });
    if (objectProblem(facts?.registrySources, 'registrySources', problems)) {
      loaderProblem(facts.registrySources.core, 'registrySources.core', problems);
      loaderProblem(facts.registrySources.docSchemas, 'registrySources.docSchemas', problems);
    }
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'every stored Firestore field is declared by its document schema',
        description:
          "Every field a local writer stores on a registered document must be declared by that document's schema in the " +
          'core package. A write whose target or payload cannot be read fails; the only way past it is a reviewed exception ' +
          'bound to its structural write site, and an exception that matches nothing is stale. Each writer anchor is a ' +
          'long-lived writer the guard must see writes in — one it no longer sees means a write form it stopped recognizing.',
        timeoutMs: 180_000,
        async run(context) {
          const r = await runWriteGuard(context.reader, facts, context.files.bind(context));
          // The coverage table prints on every run: numbers that collapse mean a broken guard, not a
          // clean tree. stderr, because a JSON test reporter owns stdout.
          process.stderr.write(`
${formatReport(r)}

`);
          const findings: Finding[] = r.violations.map((v: { kind: string; at: string; detail: string }) => ({
            file: v.at,
            detail: `${v.kind.replace(/-/g, ' ')}: ${v.detail}`,
          }));
          for (const stale of r.staleExceptions) findings.push({ file: '(exceptions)', detail: `stale exception: ${stale}` });
          const seen = new Set(r.writes.map((w: { file: string }) => w.file));
          for (const anchor of facts.writerAnchors) {
            if (!seen.has(anchor)) findings.push({ file: anchor, detail: 'writer anchor: no write seen in it' });
          }
          return findings;
        },
      },
    ];
  },
};

export const testPathGuard: GenericGuardDefinition<TestPathFacts> = {
  id: 'firestoreTestPaths',
  absentWhen: 'the app stores nothing in Firestore',
  factProblems(facts) {
    return typeof facts?.collectionNames === 'function' ? [] : ['collectionNames needs a loader of the core collection names'];
  },
  build(facts) {
    return [
      {
        title: 'test code never hand-types a Firestore path',
        description:
          "Test code builds a Firestore path through the core package: its path builders for a document, its collection " +
          'constants for a collection. No literal begins with a declared collection name and a slash, and no declared ' +
          'collection name is passed to doc / collection / collectionGroup.',
        timeoutMs: 120_000,
        async run(context) {
          const names = await facts.collectionNames();
          const files = context
            .files({
              roots: ['app', 'functions', 'e2e', 'hostedE2e', 'scripts', 'workers'],
              optionalRoots: ['functions', 'e2e', 'hostedE2e', 'scripts', 'workers'],
              kinds: ['code'],
              tests: 'only',
            })
            .map((f) => ({ path: f.path, content: f.text, sourceFile: f.sourceFile }));
          return findHandTypedFirestorePaths(files, { collectionNames: [...names] }).map((at: string) => {
            const i = at.lastIndexOf(':');
            return { file: at.slice(0, i), line: Number(at.slice(i + 1)), detail: 'hand-typed Firestore path' };
          });
        },
      },
    ];
  },
};
