// The import rules inside a repository's own packages: each package's code imports the file that
// defines each name by its built extension, only an entry index re-exports, and no package has a
// runtime import cycle. Both run on the import-path analyzer's own parse and resolution.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Finding, GuardContext } from '../../guard.js';
import { isTestPath } from '../../node/layout.js';
import type { RepoReader, Scope } from '../../node/reader.js';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import { textProblem } from '../../support/facts.js';
import { analyzePackageImports, createImportPathProfile, findImportCycles } from './analyzer.js';
import { sourceEntryModules } from './package-entries.js';

export interface PackageImportFacts {
  /** The repo-relative folder that holds the repository's packages, one per subfolder. */
  packagesFolder: string;
}

const SCOPE: Scope = { roots: ['app'], kinds: ['code'], tests: true };

const slash = (path: string) => path.replace(/\\/g, '/');

interface PackageModules {
  /** The package's repo-relative folder. */
  root: string;
  name: string;
  dir: string;
  files: Map<string, { text: string; sourceFile: import('typescript').SourceFile }>;
}

/** Every package in the folder, each with every code file the reader holds under it; none is a finding. */
function packagesOf(context: GuardContext, packagesFolder: string): { packages: PackageModules[]; missing: Finding[] } {
  const repoRoot = context.reader.layout.repoRoot;
  const folder = join(repoRoot, packagesFolder);
  const dirs = existsSync(folder)
    ? readdirSync(folder, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(folder, d.name, 'package.json')))
    : [];
  if (!dirs.length) return { packages: [], missing: [{ file: packagesFolder, detail: 'the folder holds no package' }] };
  const files = context.files(SCOPE);
  const packages = dirs.map((dirent) => {
    const root = `${slash(packagesFolder)}/${dirent.name}`;
    const dir = join(folder, dirent.name);
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { name: string };
    const own = new Map<string, { text: string; sourceFile: import('typescript').SourceFile }>();
    for (const file of files) if (file.path.startsWith(`${root}/`)) own.set(file.path, { text: file.text, sourceFile: file.sourceFile });
    return { root, name: manifest.name, dir, files: own };
  });
  return { packages, missing: [] };
}

const profileOf = (reader: RepoReader) => createImportPathProfile({ isTestFile: (p: string) => isTestPath(reader.layout, p) });

const factProblems = (facts: PackageImportFacts) => {
  const problems: string[] = [];
  textProblem(facts?.packagesFolder, 'packagesFolder', problems);
  return problems;
};

export const packageImportsGuard: GenericGuardDefinition<PackageImportFacts> = {
  id: 'packageImports',
  absentWhen: 'the repository holds no package of its own',
  factProblems,
  build(facts) {
    return [
      {
        title: "inside a package, code imports the file that defines each name by its built extension, and only an entry index re-exports",
        description:
          "Inside a package, import the file that defines each name — never a folder index, a nested entry, or the package's own " +
          'name; a test does the same, except an entry-surface test (`<name>.entry.test.ts`), which may import an entry index. ' +
          'Only an entry index re-exports, and only files in its own folder, each named directly; an index that is not a ' +
          'package entry is deleted and its importers import the defining files. Every relative import, in source and tests ' +
          "alike — a static import or `export … from`, an `import()`, and a test runner's module mock — names its file with " +
          "the file's built extension: `./x.js` for `x.ts` or `x.tsx`, `./folder/index.js` for a folder.",
        timeoutMs: 300_000,
        run(context: GuardContext): Finding[] {
          const { packages, missing } = packagesOf(context, facts.packagesFolder);
          if (missing.length) return missing;
          const repoRoot = context.reader.layout.repoRoot;
          const profile = profileOf(context.reader);
          const findings: Finding[] = [];
          for (const pkg of packages) {
            const { violations } = analyzePackageImports({
              files: pkg.files,
              packageRoot: pkg.root,
              packageName: pkg.name,
              entryFiles: sourceEntryModules(pkg.dir).map((file) => slash(relative(repoRoot, file))),
              profile,
            });
            for (const v of violations as Array<{ kind: string; file: string; detail: string }>) {
              findings.push({ file: v.file, detail: `${v.kind.replace(/-/g, ' ')}: ${v.detail}` });
            }
          }
          return findings;
        },
      },
    ];
  },
};

export const packageImportCyclesGuard: GenericGuardDefinition<PackageImportFacts> = {
  id: 'packageImportCycles',
  absentWhen: 'the repository holds no package of its own',
  factProblems,
  build(facts) {
    return [
      {
        title: 'no package has a runtime import cycle',
        description:
          "No module of a package reaches itself through the package's runtime imports and forwards (type-only imports and lazy " +
          'import() excluded): a cycle evaluates one of its modules before the names it needs exist. Import the file that ' +
          'defines each name; a cycle that remains is broken by moving the shared definition into its own file.',
        timeoutMs: 300_000,
        run(context: GuardContext): Finding[] {
          const { packages, missing } = packagesOf(context, facts.packagesFolder);
          if (missing.length) return missing;
          const profile = profileOf(context.reader);
          const findings: Finding[] = [];
          for (const pkg of packages) {
            const source = new Map([...pkg.files].filter(([path]) => path.startsWith(`${pkg.root}/src/`)));
            if (!source.size) continue;
            for (const cycle of findImportCycles({ files: source, roots: [pkg.root], profile }) as Array<{ file: string; path: string[] }>) {
              findings.push({ file: cycle.file, detail: `runtime import cycle: ${cycle.path.join(' → ')}` });
            }
          }
          return findings;
        },
      },
    ];
  },
};
