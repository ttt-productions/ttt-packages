// The import-path guard as the suite runs it: the app's code (tests included, since a test's imports
// are held to the rules too) read through the one reader and handed to the analyzer.

import type { Finding, GuardContext } from '../../guard.js';
import type { RepoReader, Scope } from '../../node/reader.js';
import { isTestPath, isUnderRoot, kindOfFile } from '../../node/layout.js';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import { objectProblem, reviewedProblems } from '../../support/facts.js';
import { analyzeImportPaths, createImportPathProfile, findUnusedIndexMembers } from './analyzer.js';

export interface ImportPathFacts {
  /** Specifier prefix → repo-relative folder (`{ '@/': 'src/' }`). */
  importAliases: Readonly<Record<string, string>>;
  /** Framework entry modules that may re-export (a deploy manifest), each with its why. */
  exceptions: ReadonlyArray<{ file: string; why: string }>;
}

const SCOPE: Scope = {
  roots: ['app', 'functions'],
  kinds: ['code'],
  tests: true,
  optionalRoots: ['functions'],
};

function readModules(files: ReturnType<RepoReader['files']>) {
  const modules = new Map<string, { text: string; sourceFile: import('typescript').SourceFile }>();
  for (const file of files)
    modules.set(file.path, { text: file.text, sourceFile: file.sourceFile });
  return modules;
}

function analyzedRoots(reader: RepoReader) {
  const { app, functions } = reader.layout.roots;
  return [app.path, ...(functions ? [functions.path] : [])];
}

/**
 * A code file on disk inside a path the layout excludes. The reader never reads it, so an import of
 * it resolves without being judged; a missing file is still an unresolved import.
 */
function excludedModuleExists(reader: RepoReader, p: string): boolean {
  return (
    (reader.layout.exclusions ?? []).some((e) => isUnderRoot(p, e.path)) &&
    kindOfFile(p.slice(p.lastIndexOf('/') + 1)) === 'code' &&
    reader.exists(p)
  );
}

function profileFor(reader: RepoReader, facts: ImportPathFacts) {
  return createImportPathProfile({
    importAliases: { ...facts.importAliases },
    exceptions: facts.exceptions.map((e) => ({ ...e })),
    isTestFile: (p: string) => isTestPath(reader.layout, p),
    isExcludedModule: (p: string) => excludedModuleExists(reader, p),
  });
}

export const importPathGuard: GenericGuardDefinition<ImportPathFacts> = {
  id: 'importPaths',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    objectProblem(facts?.importAliases, 'importAliases', problems);
    reviewedProblems(facts?.exceptions, 'exceptions', problems, { key: 'file' });
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'every definition has exactly one import path',
        description:
          'A module that is not a folder index never re-exports; a folder index forwards only files inside its folder; ' +
          'code outside a folder that has an index imports through it, never past it; code inside a folder imports its ' +
          'siblings directly, never through an index of a folder that contains it. Import the owner — the sibling file or the package.',
        timeoutMs: 120_000,
        run(context: GuardContext): Finding[] {
          const files = context.files(SCOPE);
          const result = analyzeImportPaths({
            files: readModules(files),
            roots: analyzedRoots(context.reader),
            profile: profileFor(context.reader, facts),
          });
          return result.violations.map((v: { kind: string; file: string; detail: string }) => ({
            file: v.file,
            detail: `${v.kind.replace(/-/g, ' ')}: ${v.detail}`,
          }));
        },
      },
    ];
  },
};

/** Report-only: folder index members nothing outside the folder imports. Never a failure. */
export function unusedIndexMembers(
  reader: RepoReader,
  facts: ImportPathFacts,
): Array<{ file: string; unused: string[] }> {
  return findUnusedIndexMembers({
    files: readModules(reader.files(SCOPE)),
    roots: analyzedRoots(reader),
    profile: profileFor(reader, facts),
  });
}
