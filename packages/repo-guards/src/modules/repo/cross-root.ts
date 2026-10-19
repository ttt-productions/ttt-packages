// The boundaries between an app's roots, its packages, and the world outside the repository:
//   - roots that are separate projects never import one another;
//   - a tsconfig path alias resolves only inside the root it belongs to;
//   - each package is imported from the entry point that matches the runtime of the importing root;
//   - nothing is imported from, or depended on at, a path outside the repository.

import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding } from '../../guard.js';
import { declaredRoots, type RepoLayout, type Reviewed, type RootRole } from '../../node/layout.js';
import type { Scope } from '../../node/reader.js';
import { normalizePath, resolveRelative } from '../../support/paths.js';
import { escapeRegExp, isUnder } from '../../support/text.js';
import { parseJsonc } from './jsonc.js';
import { moduleSpecifiers } from './specifiers.js';
import { namesProblem, objectProblem, pathProblem, reviewedProblems, takesNoFacts, textProblem } from '../../support/facts.js';

const CODE_ROLES: readonly RootRole[] = ['app', 'functions', 'e2e', 'hostedE2e', 'scripts', 'workers'];
const isRole = (value: unknown): value is RootRole => typeof value === 'string' && (CODE_ROLES as readonly string[]).includes(value);

// ---------------------------------------------------------------------------------------------
// Roots that are separate projects never import one another.
// ---------------------------------------------------------------------------------------------

export interface IsolatedRootsFacts {
  /** Roots that are separate projects. A Worker family isolates every Worker tree from the others. */
  isolatedRoots: readonly RootRole[];
  /** Specifier prefix → repo-relative folder, for every alias any of those roots can resolve. */
  importAliases: Readonly<Record<string, string>>;
}

/** The repo-relative path a specifier names, through a relative walk or an alias; null for a package. */
export function targetOf(fromPath: string, spec: string, aliases: Readonly<Record<string, string>>): string | null {
  const relative = resolveRelative(fromPath, spec);
  if (relative !== null) return relative.path;
  for (const [prefix, folder] of Object.entries(aliases)) {
    if (spec.startsWith(prefix)) return `${folder.replace(/\/$/, '')}/${spec.slice(prefix.length)}`;
  }
  return null;
}

export const isolatedRootsGuard: GenericGuardDefinition<IsolatedRootsFacts> = {
  id: 'isolatedRoots',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'facts', problems)) return problems;
    namesProblem(facts.isolatedRoots, 'isolatedRoots', problems);
    if (Array.isArray(facts.isolatedRoots)) {
      for (const role of facts.isolatedRoots) if (!isRole(role)) problems.push(`isolatedRoots names ${String(role)}, which is not a code root role`);
      if (facts.isolatedRoots.length === 1 && !facts.isolatedRoots.includes('workers')) problems.push('isolatedRoots needs at least two roots to keep apart');
    }
    objectProblem(facts.importAliases, 'importAliases', problems);
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'roots that are separate projects never import one another',
        description:
          `No file in one of ${facts.isolatedRoots.join(', ')} imports a file in another — not by relative path, not through ` +
          'a path alias, not by naming the other root. A shape both sides need crosses the boundary as a package.',
        run(context) {
          const roots = declaredRoots(context.reader.layout).filter((r) => facts.isolatedRoots.includes(r.role));
          const findings: Finding[] = [];
          const scope: Scope = { roots: facts.isolatedRoots, kinds: ['code'], tests: false, optionalRoots: facts.isolatedRoots.filter((r) => r !== 'app') };
          for (const file of context.files(scope)) {
            for (const { spec, line } of moduleSpecifiers(file)) {
              const target = targetOf(file.path, spec, facts.importAliases);
              const other = roots.find(
                (r) =>
                  r.name !== file.rootName &&
                  (target !== null ? isUnder(target, r.root.path) : spec.startsWith(`${r.root.path}/`) || spec.includes(`/${r.root.path}/`)),
              );
              if (other) findings.push({ file: file.path, line, detail: `imports from the ${other.name} root: ${spec}` });
            }
          }
          return findings;
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// A tsconfig path alias resolves only inside the root it belongs to.
// ---------------------------------------------------------------------------------------------

export interface TsconfigAliasFacts {
  /** Each tsconfig with the root (its role, or a Worker's name) its aliases must stay inside. */
  tsconfigs: ReadonlyArray<{ file: string; root: string }>;
}

/** Each alias target a tsconfig's `paths` declares that lands outside `rootPath`. */
export function aliasesOutsideRoot(tsconfigFile: string, text: string, rootPath: string): string[] {
  const config = parseJsonc(text) as { compilerOptions?: { baseUrl?: string; paths?: Record<string, unknown> } };
  const paths = config.compilerOptions?.paths ?? {};
  const dir = tsconfigFile.includes('/') ? tsconfigFile.slice(0, tsconfigFile.lastIndexOf('/')) : '';
  const base = config.compilerOptions?.baseUrl ?? '.';
  const out: string[] = [];
  for (const [alias, targets] of Object.entries(paths)) {
    for (const target of Array.isArray(targets) ? targets : [targets]) {
      const normalized = typeof target === 'string' ? normalizePath(`${dir}/${base}/${target.replace(/\*.*$/, '')}`) : null;
      const resolved = normalized && !normalized.escapes ? normalized.path : null;
      if (resolved === null || !isUnder(resolved || '.', rootPath)) out.push(`${alias} → ${String(target)}`);
    }
  }
  return out;
}

export const tsconfigAliasGuard: GenericGuardDefinition<TsconfigAliasFacts> = {
  id: 'tsconfigAliasesInRoot',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'facts', problems)) return problems;
    if (!Array.isArray(facts.tsconfigs)) problems.push('tsconfigs is missing');
    else if (!facts.tsconfigs.length) problems.push('tsconfigs is empty');
    else
      for (const t of facts.tsconfigs) {
        pathProblem(t?.file, 'a tsconfig entry\'s file', problems);
        textProblem(t?.root, `tsconfig ${String(t?.file)}'s root`, problems);
      }
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'every tsconfig path alias resolves inside its own root',
        description:
          'Each tsconfig path alias resolves to a folder inside the root that tsconfig compiles. An alias reaching another ' +
          'root, a sibling checkout, or anything outside the repository is an import path the import statements never ' +
          'admit. Import another root through a package, and a package from node_modules.',
        run(context) {
          const roots = new Map(declaredRoots(context.reader.layout).map((r) => [r.name, r.root.path]));
          const findings: Finding[] = [];
          for (const { file, root } of facts.tsconfigs) {
            const rootPath = roots.get(root);
            if (rootPath === undefined) findings.push({ file, detail: `names the root ${root}, which the layout does not declare` });
            else if (!context.reader.exists(file)) findings.push({ file, detail: 'the tsconfig does not exist' });
            else {
              let outside: string[];
              try {
                outside = aliasesOutsideRoot(file, context.file(file).text, rootPath);
              } catch (err) {
                findings.push({ file, detail: `cannot be parsed: ${(err as Error).message}` });
                continue;
              }
              for (const alias of outside) findings.push({ file, detail: `alias resolves outside ${rootPath}: ${alias}` });
            }
          }
          return findings;
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// Package entry points match the runtime of the importing root.
// ---------------------------------------------------------------------------------------------

export interface EntryPointFacts {
  /** The shared packages' npm scope (`@scope`). */
  packageScope: string;
  /** Roots that run only on a server (no React, browser runtime, Next.js, or stylesheet). */
  serverRoots: readonly RootRole[];
  /** Roots that ship to a browser (no server-only package entry, no Admin SDK). */
  clientRoots: readonly RootRole[];
  /** Folders or files inside a client root that run only on a server, each with its why. */
  serverOnlyPaths: readonly Reviewed[];
}

export function bannedEntryPoints(packageScope: string) {
  const scope = escapeRegExp(packageScope.replace(/\/$/, ''));
  return {
    server: [
      { re: new RegExp(`^${scope}/[^/]+/(?:react|browser|styles|client)(?:/|$)`), why: 'client-only package entry point' },
      { re: /^(?:react|react-dom|next)(?:\/|$)/, why: 'React or Next.js runtime' },
      { re: /\.css$/, why: 'stylesheet side effect' },
    ],
    client: [
      { re: new RegExp(`^${scope}/[^/]+/(?:admin|server)(?:/|$)`), why: 'server-only package entry point' },
      { re: /^firebase-admin(?:\/|$)/, why: 'Admin SDK' },
    ],
  };
}

export const entryPointGuard: GenericGuardDefinition<EntryPointFacts> = {
  id: 'packageEntryPoints',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'facts', problems)) return problems;
    if (typeof facts.packageScope !== 'string' || !/^@[a-z0-9][\w.-]*$/.test(facts.packageScope)) problems.push('packageScope is not an npm scope (@name)');
    for (const key of ['serverRoots', 'clientRoots'] as const) {
      namesProblem(facts[key], key, problems, { nonEmpty: false });
      for (const role of Array.isArray(facts[key]) ? facts[key] : []) if (!isRole(role)) problems.push(`${key} names ${String(role)}, which is not a code root role`);
    }
    if (Array.isArray(facts.serverRoots) && Array.isArray(facts.clientRoots)) {
      if (!facts.serverRoots.length && !facts.clientRoots.length) problems.push('neither serverRoots nor clientRoots names a root');
      for (const role of facts.serverRoots) if (facts.clientRoots.includes(role)) problems.push(`${role} is both a server and a client root`);
    }
    reviewedProblems(facts.serverOnlyPaths, 'serverOnlyPaths', problems);
    return problems;
  },
  build(facts) {
    const banned = bannedEntryPoints(facts.packageScope);
    return [
      {
        title: 'each package is imported from the entry point matching the runtime',
        description:
          `Server-only roots (${facts.serverRoots.join(', ') || 'none'}) never import a /react, /browser, /client or /styles ` +
          `entry of a ${facts.packageScope} package, react, react-dom, next, or a stylesheet. Client roots ` +
          `(${facts.clientRoots.join(', ') || 'none'}), outside their declared server-only paths, never import an /admin or ` +
          '/server entry or firebase-admin. Import the entry point that matches where the code runs; privileged work goes ' +
          'through the backend.',
        run(context) {
          const findings: Finding[] = [];
          const rolesOf = (roots: readonly RootRole[]): Scope => ({ roots, kinds: ['code'], tests: false, optionalRoots: roots.filter((r) => r !== 'app') });
          for (const p of facts.serverOnlyPaths) {
            if (!context.reader.exists(p.path)) findings.push({ file: p.path, detail: 'stale server-only path: it no longer exists' });
          }
          const check = (roots: readonly RootRole[], list: typeof banned.server, skipServerOnly: boolean) => {
            if (!roots.length) return;
            for (const file of context.files(rolesOf(roots))) {
              if (skipServerOnly && facts.serverOnlyPaths.some((p) => isUnder(file.path, p.path))) continue;
              for (const { spec, line } of moduleSpecifiers(file)) {
                const hit = list.find((entry) => entry.re.test(spec));
                if (hit) findings.push({ file: file.path, line, detail: `${spec} (${hit.why})` });
              }
            }
          };
          check(facts.serverRoots, banned.server, false);
          check(facts.clientRoots, banned.client, true);
          return findings;
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// Nothing is imported from, or depended on at, a path outside the repository.
// ---------------------------------------------------------------------------------------------

/** The filesystem target of a dependency range that names a path, or null for a registry range. */
export function localDependencyTarget(range: string): string | null {
  const protocol = /^(?:file|link):(.*)$/.exec(range);
  if (protocol) return protocol[1];
  if (/^(?:\.\.?\/|\/|~\/)/.test(range)) return range;
  if (/\.tgz$/.test(range)) return range;
  return null;
}

const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;

/** Each dependency a manifest resolves to a local path. */
export function localDependencies(manifestText: string): string[] {
  const manifest = JSON.parse(manifestText) as Partial<Record<(typeof DEPENDENCY_SECTIONS)[number], Record<string, string>>>;
  const out: string[] = [];
  for (const section of DEPENDENCY_SECTIONS) {
    for (const [name, range] of Object.entries(manifest[section] ?? {})) {
      if (typeof range === 'string' && localDependencyTarget(range) !== null) out.push(`${section}.${name} → ${range}`);
    }
  }
  return out;
}

/** The repository's manifests: the root one and the nearest one above each declared code root. */
export function manifestsOf(layout: RepoLayout, exists: (relPath: string) => boolean): string[] {
  const out = new Set<string>(['package.json']);
  for (const { role, root } of declaredRoots(layout)) {
    if (role === 'coreDist') continue;
    const parts = root.path.split('/');
    for (let depth = parts.length; depth > 0; depth -= 1) {
      const candidate = `${parts.slice(0, depth).join('/')}/package.json`;
      if (exists(candidate)) {
        out.add(candidate);
        break;
      }
    }
  }
  return [...out].sort();
}

const OUTSIDE_SCOPE: Scope = {
  roots: CODE_ROLES,
  kinds: ['code'],
  tests: true,
  optionalRoots: CODE_ROLES.filter((r) => r !== 'app'),
};

export type NoOutsideCheckoutFacts = Readonly<Record<string, never>>;

export const noOutsideCheckoutGuard: GenericGuardDefinition<NoOutsideCheckoutFacts> = {
  id: 'noOutsideCheckout',
  absentWhen: false,
  factProblems: takesNoFacts,
  build() {
    return [
      {
        title: 'nothing is imported from, or depended on at, a path outside the repository',
        description:
          'No relative import climbs above the repository root (a checkout beside the repository is source nobody else ' +
          'has), and no manifest dependency names a path (file:, link:, a relative or absolute path, a .tgz) instead of a ' +
          'published version. Change the package where it lives, publish it, and depend on the published version.',
        timeoutMs: 120_000,
        run(context) {
          const findings: Finding[] = [];
          for (const file of context.files(OUTSIDE_SCOPE)) {
            for (const { spec, line } of moduleSpecifiers(file)) {
              if (resolveRelative(file.path, spec)?.escapes) {
                findings.push({ file: file.path, line, detail: `imports from outside the repository: ${spec}` });
              }
            }
          }
          for (const manifest of manifestsOf(context.reader.layout, (p) => context.reader.exists(p))) {
            for (const dependency of localDependencies(context.file(manifest).text)) {
              findings.push({ file: manifest, detail: `depends on a local path: ${dependency}` });
            }
          }
          return findings;
        },
      },
    ];
  },
};
