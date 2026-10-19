// One package entry per definition. Every definition a package exports is exported by exactly one of
// its entries — the entry of the folder that holds it — and every consumer imports it from there. A
// file-level entry owns only its own file, and only when no folder entry below the root covers that
// file; the root owns every other file. The ownership is read from a TypeScript program over the
// package's entry modules: its source for the package's own check, its installed build for a
// consumer's.

import ts from 'typescript';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { Finding, GuardContext } from '../../guard.js';
import type { GenericGuardDefinition } from '../../suite/config.js';
import type { Scope } from '../../node/reader.js';
import { textProblem } from '../../support/facts.js';

const slash = (path: string) => path.replace(/\\/g, '/');

/** One entry of a package's `exports`: its key (`.`, `./react`), its import specifier, and its module. */
export interface PackageEntry {
  key: string;
  spec: string;
  /** Absolute path of the entry's module (source or declaration file). */
  file: string;
  /** The folder the entry owns when its module is a folder index; null for a file-level entry. */
  folder: string | null;
}

/** A package's entries and, for each entry, the names it exports and the declaration each resolves to. */
export interface EntryOwnership {
  packageName: string;
  packageDir: string;
  entries: PackageEntry[];
  /** entry key → exported name → the declaration it resolves to (`<absolute file>#<declared name>`). */
  exportsByEntry: Map<string, Map<string, string>>;
  /** The entry that owns a declaration file, or null when no entry covers it. */
  ownerOf(file: string): PackageEntry | null;
  /** Entry keys `exports` names that could not be read (no types, a module missing), each with why. */
  unreadable: Array<{ key: string; why: string }>;
}

/** The `types` path of one `exports` value, wherever its conditions nest it. */
function typesPathOf(value: unknown): string | null {
  if (typeof value === 'string') return /\.d\.[cm]?ts$/.test(value) ? value : null;
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.types === 'string') return record.types;
  for (const nested of Object.values(record)) {
    const found = typesPathOf(nested);
    if (found) return found;
  }
  return null;
}

/** The source module a declaration path is built from (`dist/x/index.d.ts` → `src/x/index.ts(x)`). */
function sourceOf(packageDir: string, typesPath: string): string | null {
  const stem = slash(typesPath).replace(/^\.\//, '').replace(/^dist\//, 'src/').replace(/\.d\.([cm]?)ts$/, '');
  for (const extension of ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs']) {
    const candidate = join(packageDir, `${stem}${extension}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** The source module each of a package's `exports` entries is built from, absolute; entries with no source left out. */
export function sourceEntryModules(packageDir: string): string[] {
  const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as { exports?: Record<string, unknown> };
  const modules: string[] = [];
  for (const [key, value] of Object.entries(manifest.exports ?? {})) {
    if (key.includes('*') || key === './package.json') continue;
    const typesPath = typesPathOf(value);
    const file = typesPath ? sourceOf(packageDir, typesPath) : null;
    if (file) modules.push(resolve(file));
  }
  return modules;
}

const isIndexModule = (file: string) => /^index\.(d\.[cm]?ts|[cm]?[jt]sx?)$/.test(file.slice(slash(file).lastIndexOf('/') + 1));

/**
 * Reads a package's entries and what each exports. `from: 'source'` maps every entry to the source
 * module it is built from; `from: 'build'` reads the installed declaration files.
 */
export function readEntryOwnership(packageDir: string, from: 'source' | 'build'): EntryOwnership {
  const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as { name: string; exports?: Record<string, unknown> };
  const entries: PackageEntry[] = [];
  const unreadable: Array<{ key: string; why: string }> = [];
  for (const [key, value] of Object.entries(manifest.exports ?? {})) {
    if (key.includes('*') || key === './package.json') continue;
    const typesPath = typesPathOf(value);
    if (!typesPath) continue;
    const file = from === 'source' ? sourceOf(packageDir, typesPath) : join(packageDir, typesPath);
    if (!file || !existsSync(file)) {
      unreadable.push({ key, why: from === 'source' ? `no source module builds ${typesPath}` : `${typesPath} is not installed` });
      continue;
    }
    entries.push({
      key,
      spec: key === '.' ? manifest.name : `${manifest.name}/${key.replace(/^\.\//, '')}`,
      file: resolve(file),
      folder: isIndexModule(file) ? resolve(dirname(file)) : null,
    });
  }

  const program = ts.createProgram(
    entries.map((e) => e.file),
    {
      noEmit: true,
      skipLibCheck: true,
      allowJs: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
    },
  );
  const checker = program.getTypeChecker();
  const inPackage = (file: string) => {
    const rel = slash(relative(packageDir, file));
    return !rel.startsWith('..') && !rel.includes('node_modules/');
  };
  const exportsByEntry = new Map<string, Map<string, string>>();
  for (const entry of entries) {
    const names = new Map<string, string>();
    const sourceFile = program.getSourceFile(entry.file);
    const moduleSymbol = sourceFile ? checker.getSymbolAtLocation(sourceFile) : undefined;
    for (const exported of moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : []) {
      const target = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
      const declaration = target.declarations?.[0];
      if (!declaration) continue;
      const declaredIn = resolve(declaration.getSourceFile().fileName);
      if (!inPackage(declaredIn)) continue;
      names.set(exported.getName(), `${declaredIn}#${target.getName()}`);
    }
    exportsByEntry.set(entry.key, names);
  }

  const root = entries.find((e) => e.key === '.' && e.folder) ?? null;
  const folderEntries = entries.filter((e) => e.folder && e !== root);
  const fileEntries = entries.filter((e) => !e.folder);
  const ownerOf = (file: string): PackageEntry | null => {
    const absolute = resolve(file);
    const covering = folderEntries
      .filter((e) => slash(absolute).startsWith(`${slash(e.folder!)}/`))
      .sort((a, b) => b.folder!.length - a.folder!.length)[0];
    if (covering) return covering;
    const own = fileEntries.find((e) => moduleStem(e.file) === moduleStem(absolute));
    if (own) return own;
    if (root && slash(absolute).startsWith(`${slash(root.folder!)}/`)) return root;
    return null;
  };
  return { packageName: manifest.name, packageDir, entries, exportsByEntry, ownerOf, unreadable };
}

/** A module's path without its extension, so a declaration file and its source compare equal. */
const moduleStem = (file: string) => slash(file).replace(/\.d\.([cm]?)ts$/, '').replace(/\.[cm]?[jt]sx?$/, '');

/** Every definition of a package exported by more than one entry, or by an entry that does not own it. */
export function entryOwnershipFindings(ownership: EntryOwnership, repoRoot: string): Finding[] {
  const findings: Finding[] = [];
  const rel = (file: string) => slash(relative(repoRoot, file));
  for (const { key, why } of ownership.unreadable) findings.push({ file: rel(join(ownership.packageDir, 'package.json')), detail: `entry ${key}: ${why}` });
  const byDeclaration = new Map<string, Array<{ entry: PackageEntry; name: string }>>();
  for (const entry of ownership.entries) {
    for (const [name, declaration] of ownership.exportsByEntry.get(entry.key) ?? []) {
      byDeclaration.set(declaration, [...(byDeclaration.get(declaration) ?? []), { entry, name }]);
    }
  }
  for (const [declaration, exporters] of [...byDeclaration].sort(([a], [b]) => a.localeCompare(b))) {
    const hash = declaration.lastIndexOf('#');
    const file = declaration.slice(0, hash);
    const declared = declaration.slice(hash + 1);
    const owner = ownership.ownerOf(file);
    const specs = [...new Set(exporters.map((e) => `'${e.entry.spec}'`))];
    if (!owner) {
      findings.push({ file: rel(file), detail: `${declared} is exported by ${specs.join(', ')}, but no entry covers its file` });
    } else if (specs.length > 1 || exporters[0].entry !== owner) {
      findings.push({
        file: rel(file),
        detail: `${declared} is exported by ${specs.join(', ')}; only its folder's entry '${owner.spec}' exports it`,
      });
    }
  }
  return findings;
}

// --- the package's own check -------------------------------------------------------------------

export interface PackageEntryFacts {
  /** The repo-relative folder that holds the repository's packages, one per subfolder. */
  packagesFolder: string;
}

export const packageEntriesGuard: GenericGuardDefinition<PackageEntryFacts> = {
  id: 'packageEntries',
  absentWhen: 'the repository holds no package of its own',
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.packagesFolder, 'packagesFolder', problems);
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'every definition a package exports is exported by exactly one entry, its folder’s',
        description:
          "Each definition a package exports is exported by exactly one of the package's entries — the entry of the folder " +
          'that holds it; a file-level entry owns only its own file, and the root owns the rest. A definition the root, a ' +
          "parent folder's entry, or a second entry also exports fails. Export it from its folder's entry alone.",
        timeoutMs: 300_000,
        run(context: GuardContext): Finding[] {
          const findings: Finding[] = [];
          const repoRoot = context.reader.layout.repoRoot;
          const folder = join(repoRoot, facts.packagesFolder);
          const packages = existsSync(folder)
            ? readdirSync(folder, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(folder, d.name, 'package.json')))
            : [];
          if (!packages.length) return [{ file: facts.packagesFolder, detail: 'the folder holds no package' }];
          for (const dirent of packages) {
            context.file(`${slash(facts.packagesFolder)}/${dirent.name}/package.json`);
            findings.push(...entryOwnershipFindings(readEntryOwnership(join(folder, dirent.name), 'source'), repoRoot));
          }
          return findings;
        },
      },
    ];
  },
};

// --- a consumer's check ------------------------------------------------------------------------

export interface PackageEntryImportFacts {
  /** The npm scope whose packages the rule holds (`@ttt-productions`). */
  scope: string;
}

const CONSUMER_SCOPE: Scope = {
  roots: ['app', 'functions', 'e2e', 'hostedE2e', 'scripts', 'workers'],
  kinds: ['code'],
  tests: true,
  optionalRoots: ['functions', 'e2e', 'hostedE2e', 'scripts', 'workers'],
};

/** The installed package a file resolves `packageName` to: the nearest `node_modules` above it. */
function installedPackageDir(fromFile: string, repoRoot: string, packageName: string): string | null {
  let dir = dirname(fromFile);
  const top = resolve(repoRoot);
  for (;;) {
    const candidate = join(dir, 'node_modules', ...packageName.split('/'));
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    if (resolve(dir) === top) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export const packageEntryImportsGuard: GenericGuardDefinition<PackageEntryImportFacts> = {
  id: 'packageEntryImports',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.scope, 'scope', problems);
    if (typeof facts?.scope === 'string' && !/^@[a-z0-9][a-z0-9._-]*$/.test(facts.scope)) problems.push('scope must be an npm scope such as @acme');
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'every package definition is imported from the entry that owns it',
        description:
          "A consumer imports each definition of a scoped package from the entry that owns it — the entry of the folder that " +
          'holds it — never from the root, a parent folder\'s entry, or another entry that also carries it. The failure names ' +
          'the owning entry; import from there.',
        timeoutMs: 300_000,
        run(context: GuardContext): Finding[] {
          const findings: Finding[] = [];
          const repoRoot = context.reader.layout.repoRoot;
          const cache = new Map<string, EntryOwnership>();
          const pattern = new RegExp(`^(${facts.scope.replace(/[.]/g, '\\.')}/[^/]+)(/.+)?$`);
          for (const file of context.files(CONSUMER_SCOPE)) {
            for (const imported of file.imports) {
              if ((imported.kind !== 'import' && imported.kind !== 'export') || !imported.named.length) continue;
              const match = pattern.exec(imported.spec);
              if (!match) continue;
              const packageDir = installedPackageDir(join(repoRoot, file.path), repoRoot, match[1]);
              if (!packageDir) continue;
              let ownership = cache.get(packageDir);
              if (!ownership) {
                ownership = readEntryOwnership(packageDir, 'build');
                cache.set(packageDir, ownership);
              }
              const key = match[2] ? `.${match[2]}` : '.';
              const names = ownership.exportsByEntry.get(key);
              if (!names) continue;
              for (const { imported: name } of imported.named) {
                const declaration = names.get(name);
                if (!declaration) continue;
                const owner = ownership.ownerOf(declaration.slice(0, declaration.lastIndexOf('#')));
                if (owner && owner.key !== key) {
                  findings.push({
                    file: file.path,
                    line: file.sourceFile.getLineAndCharacterOfPosition(imported.node.getStart(file.sourceFile)).line + 1,
                    detail: `imports ${name} from '${imported.spec}', but its entry is '${owner.spec}'`,
                  });
                }
              }
            }
          }
          return findings;
        },
      },
    ];
  },
};
