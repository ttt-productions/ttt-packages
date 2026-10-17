// The one reader every guard reads the repository through. It walks each declared root once, reads
// each file once, and strips and parses each file once; every guard in a run shares what it read.
//
// It fails closed: a folder it cannot read throws naming the folder, a root a guard asks for that
// the layout does not declare throws, and an exclusion that names nothing on disk is stale.

import fs from 'node:fs';
import path from 'node:path';
import {
  FILE_KINDS,
  ROOT_ROLES,
  SKIPPED_FOLDER_NAMES,
  declaredRoots,
  isTestPath,
  isUnderRoot,
  kindOfFile,
  rulesServiceOf,
  type FileKind,
  type RepoLayout,
  type RootRole,
  type RulesService,
} from './layout.js';
import { isText, reviewedProblems } from '../support/facts.js';
import { dirnameOf, normalizePath } from '../support/paths.js';
import { stripRulesComments } from './strip-comments.js';
import { buildView, type FileRole, type FileView } from './view.js';

/** Which files a guard reads. */
export interface Scope {
  roots: readonly RootRole[];
  kinds: readonly FileKind[];
  /** `true` reads tests too, `false` leaves them out, `'only'` reads nothing but test code. */
  tests: boolean | 'only';
  /** Roles the guard reads when the app has them; any other role must be declared. */
  optionalRoots?: readonly RootRole[];
}

export interface RepoReader {
  readonly layout: RepoLayout;
  /** Every file in the scope, sorted by path. */
  files(scope: Scope): FileView[];
  /** One named file. A file that does not exist or cannot be read throws. */
  file(relPath: string): FileView;
  exists(relPath: string): boolean;
  /** Every rules file the layout lists, or those written for `service`, in the layout's order. */
  rulesFiles(service?: RulesService): FileView[];
  /** Each declared root's anchor the walk failed to reach. Empty when every root was walked whole. */
  unreachedAnchors(): string[];
  /**
   * The files of the given kinds an installed package ships (`<under>/node_modules/<name>`, `under`
   * defaulting to the repository root), its own dependencies left out. A package that is not
   * installed there ships none; one that is installed but cannot be read throws. Each file's role is
   * `installed` and its root name the package's, unless it lies under a declared root.
   */
  installedFiles(packageName: string, options: { kinds: readonly FileKind[]; under?: string }): FileView[];
  /**
   * The text of a file outside the checkout (a sibling repository), by absolute path, or null when
   * it is absent. A file that exists but cannot be read throws. A guard that reads one says so in
   * its scope, and the suite shows it skipped, with its reason, where the file is absent.
   */
  readOutside(absolutePath: string): string | null;
  /** Whether a folder or file outside the checkout (a sibling repository) exists, by absolute path. */
  existsOutside(absolutePath: string): boolean;
}

const toPosix = (p: string) => p.split(path.sep).join('/');

/**
 * A symbolic link is neither followed nor skipped: following one can leave the repository or loop,
 * and skipping one would leave whatever it points at unchecked while every guard passes.
 */
function symbolicLinkError(rel: string): Error {
  return new Error(`repo-guards: ${rel} is a symbolic link, which the reader neither follows nor skips — replace it with what it points at, or exclude it by path`);
}

/**
 * A link skipped by its name, as the folder it names would be — a dependency, build, or dot folder —
 * so a linked dependency tree is skipped like a real one. A link with a dot name a guard reads as a
 * file is no such folder, and fails like any other link.
 */
const skippedByName = (name: string) => SKIPPED_FOLDER_NAMES.has(name) || (name.startsWith('.') && kindOfFile(name) === null);

/** Each rules file the deploy config deploys that the layout's `rulesFiles` does not list, in words. */
function deployedRulesProblems(layout: RepoLayout, onDisk: (rel: string) => boolean): string[] {
  const config = layout.firebaseConfig!;
  if (!isText(config)) return ['firebaseConfig is missing'];
  if (!onDisk(config)) return [`firebaseConfig ${config} does not exist`];
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(fs.readFileSync(path.join(layout.repoRoot, config), 'utf8')) as Record<string, unknown>;
  } catch (err) {
    return [`firebaseConfig ${config} cannot be read as JSON (${(err as Error).message})`];
  }
  const listed = new Set(layout.rulesFiles ?? []);
  const problems: string[] = [];
  for (const service of ['firestore', 'storage']) {
    const entries = parsed[service];
    for (const entry of Array.isArray(entries) ? entries : entries ? [entries] : []) {
      const rules = (entry as { rules?: unknown })?.rules;
      if (typeof rules !== 'string') continue;
      const deployed = normalizePath(`${dirnameOf(config)}/${rules}`).path;
      if (!listed.has(deployed)) problems.push(`${config} deploys the ${service} rules file ${deployed}, which rulesFiles does not list`);
    }
  }
  return problems;
}

/** Every problem with a layout, in words. An empty list means the layout can be read. */
export function layoutProblems(layout: RepoLayout): string[] {
  const problems: string[] = [];
  if (!layout || typeof layout.repoRoot !== 'string' || !path.isAbsolute(layout.repoRoot)) {
    return ['the layout needs the absolute path of the repository root'];
  }
  if (!layout.roots?.app) problems.push('the layout declares no app root');
  const onDisk = (rel: string) => fs.existsSync(path.join(layout.repoRoot, rel));
  for (const { name, root } of declaredRoots(layout)) {
    if (!root.path || !root.anchor) {
      problems.push(`root ${name} needs both its path and an anchor file`);
      continue;
    }
    if (!onDisk(root.path)) problems.push(`root ${name} (${root.path}) does not exist`);
    if (root.anchor === root.path || !isUnderRoot(root.anchor, root.path)) problems.push(`root ${name}'s anchor ${root.anchor} is not under ${root.path}`);
    else if (!onDisk(root.anchor)) problems.push(`root ${name}'s anchor ${root.anchor} does not exist`);
  }
  const rulesFiles = layout.rulesFiles ?? [];
  if (new Set(rulesFiles).size !== rulesFiles.length) problems.push('rulesFiles lists a file twice');
  for (const file of rulesFiles) {
    if (!onDisk(file)) {
      problems.push(`rules file ${file} does not exist`);
      continue;
    }
    let text: string;
    try {
      text = fs.readFileSync(path.join(layout.repoRoot, file), 'utf8');
    } catch (err) {
      problems.push(`rules file ${file} cannot be read (${(err as NodeJS.ErrnoException)?.code ?? err})`);
      continue;
    }
    if (!rulesServiceOf(stripRulesComments(text))) {
      problems.push(`rules file ${file} declares neither service cloud.firestore nor service firebase.storage, or both`);
    }
  }
  if (layout.firebaseConfig !== undefined) problems.push(...deployedRulesProblems(layout, onDisk));
  const stillThere = (entry: Record<string, unknown>, label: string) => {
    if (isText(entry.path) && !onDisk(entry.path)) problems.push(`${label} no longer exists`);
  };
  if (layout.exclusions !== undefined) reviewedProblems(layout.exclusions, 'exclusions', problems, { extra: stillThere });
  if (layout.testCodePaths !== undefined) reviewedProblems(layout.testCodePaths, 'testCodePaths', problems, { extra: stillThere });
  if (layout.testCodeNameMarkers !== undefined) reviewedProblems(layout.testCodeNameMarkers, 'testCodeNameMarkers', problems, { key: 'marker' });
  for (const { anchor, path: rootPath } of declaredRoots(layout).map(({ root }) => root)) {
    for (const { path: excluded } of layout.exclusions ?? []) {
      if (isUnderRoot(anchor, excluded)) problems.push(`anchor ${anchor} is excluded by ${excluded}`);
      if (rootPath === excluded) problems.push(`root ${rootPath} is itself excluded`);
    }
  }
  return problems;
}

/** The reader for one app's repository. A layout with any problem throws, listing every one. */
export function createRepoReader(layout: RepoLayout): RepoReader {
  const problems = layoutProblems(layout);
  if (problems.length) throw new Error(`repo-guards: the repository layout is not readable:\n  - ${problems.join('\n  - ')}`);

  const repoRoot = layout.repoRoot;
  const excluded = new Set((layout.exclusions ?? []).map((e) => e.path));
  const views = new Map<string, FileView>();
  const walked = new Map<string, Array<{ path: string; kind: FileKind }>>();
  const roots = declaredRoots(layout);

  const makeView = (rel: string, role: FileRole, rootName: string, kind: FileKind): FileView => {
    const cached = views.get(rel);
    if (cached) return cached;
    const view = buildView({
      path: rel,
      role,
      rootName,
      kind,
      isTest: isTestPath(layout, rel),
      load: () => {
        try {
          return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
        } catch (err) {
          throw new Error(`repo-guards: cannot read ${rel} (${(err as NodeJS.ErrnoException)?.code ?? err})`, { cause: err });
        }
      },
    });
    views.set(rel, view);
    return view;
  };

  const walkRoot = (rootPath: string) => {
    const done = walked.get(rootPath);
    if (done) return done;
    const out: Array<{ path: string; kind: FileKind }> = [];
    const walk = (dir: string) => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (err) {
        throw new Error(`repo-guards: cannot read folder ${toPosix(path.relative(repoRoot, dir)) || '.'} (${(err as NodeJS.ErrnoException)?.code ?? err})`, { cause: err });
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = toPosix(path.relative(repoRoot, full));
        if (excluded.has(rel)) continue;
        if (entry.isDirectory() ? entry.name.startsWith('.') || SKIPPED_FOLDER_NAMES.has(entry.name) : entry.isSymbolicLink() && skippedByName(entry.name)) continue;
        if (entry.isSymbolicLink()) throw symbolicLinkError(rel);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          const kind = kindOfFile(entry.name);
          if (kind) out.push({ path: rel, kind });
        }
      }
    };
    walk(path.join(repoRoot, rootPath));
    out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    walked.set(rootPath, out);
    return out;
  };

  const roleOf = (rel: string) => {
    let best: { role: RootRole; name: string; length: number } | null = null;
    for (const { role, name, root } of roots) {
      const length = root.path === '.' ? 0 : root.path.length;
      if (isUnderRoot(rel, root.path) && (!best || length > best.length)) best = { role, name, length };
    }
    return best;
  };

  const readFile = (relPath: string): FileView => {
    const name = relPath.slice(relPath.lastIndexOf('/') + 1);
    const kind = kindOfFile(name);
    if (!kind) throw new Error(`repo-guards: ${relPath} is no kind of file a guard reads`);
    if (!fs.existsSync(path.join(repoRoot, relPath))) throw new Error(`repo-guards: ${relPath} does not exist`);
    const owner = roleOf(relPath);
    const view = makeView(relPath, owner?.role ?? 'repository', owner?.name ?? '(repository)', kind);
    void view.text;
    return view;
  };

  return {
    layout,
    files(scope) {
      if (!scope.roots.length) throw new Error('repo-guards: a scope names no root');
      for (const kind of scope.kinds) if (!FILE_KINDS.includes(kind)) throw new Error(`repo-guards: unknown file kind ${kind}`);
      if (!scope.kinds.length) throw new Error('repo-guards: a scope names no file kind');
      const out: FileView[] = [];
      const seen = new Set<string>();
      for (const role of scope.roots) {
        if (!ROOT_ROLES.includes(role)) throw new Error(`repo-guards: unknown root role ${role}`);
        const matching = roots.filter((r) => r.role === role);
        if (!matching.length) {
          if (scope.optionalRoots?.includes(role)) continue;
          throw new Error(`repo-guards: a guard reads the ${role} root, which the layout does not declare`);
        }
        for (const { name, root } of matching) {
          for (const entry of walkRoot(root.path)) {
            if (seen.has(entry.path) || !scope.kinds.includes(entry.kind)) continue;
            // A nested declared root belongs to its own role, never to the root that contains it.
            const owner = roleOf(entry.path);
            if (owner && owner.name !== name) continue;
            const test = isTestPath(layout, entry.path);
            if (scope.tests === false && test) continue;
            if (scope.tests === 'only' && !test) continue;
            seen.add(entry.path);
            out.push(makeView(entry.path, role, name, entry.kind));
          }
        }
      }
      return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    },
    file: readFile,
    exists(relPath) {
      return fs.existsSync(path.join(repoRoot, relPath));
    },
    rulesFiles(service) {
      return (layout.rulesFiles ?? []).map(readFile).filter((view) => !service || rulesServiceOf(view.code) === service);
    },
    installedFiles(packageName, { kinds, under }) {
      const base = toPosix(path.join(under ?? '', 'node_modules', ...packageName.split('/')));
      if (!fs.existsSync(path.join(repoRoot, base))) return [];
      const out: FileView[] = [];
      const walk = (dir: string) => {
        let entries: fs.Dirent[];
        try {
          entries = fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true });
        } catch (err) {
          throw new Error(`repo-guards: cannot read installed package folder ${dir} (${(err as NodeJS.ErrnoException)?.code ?? err})`, { cause: err });
        }
        for (const entry of entries) {
          const rel = `${dir}/${entry.name}`;
          if ((entry.isDirectory() || entry.isSymbolicLink()) && entry.name === 'node_modules') continue;
          if (entry.isSymbolicLink()) throw symbolicLinkError(rel);
          if (entry.isDirectory()) {
            walk(rel);
          } else if (entry.isFile()) {
            const kind = kindOfFile(entry.name);
            const owner = roleOf(rel);
            if (kind && kinds.includes(kind)) out.push(makeView(rel, owner?.role ?? 'installed', owner?.name ?? packageName, kind));
          }
        }
      };
      walk(base);
      return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    },
    readOutside(absolutePath) {
      if (!path.isAbsolute(absolutePath)) throw new Error(`repo-guards: ${absolutePath} is not an absolute path`);
      try {
        return fs.readFileSync(absolutePath, 'utf8');
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
        throw new Error(`repo-guards: cannot read ${absolutePath} (${(err as NodeJS.ErrnoException)?.code ?? err})`, { cause: err });
      }
    },
    existsOutside(absolutePath) {
      if (!path.isAbsolute(absolutePath)) throw new Error(`repo-guards: ${absolutePath} is not an absolute path`);
      return fs.existsSync(absolutePath);
    },
    unreachedAnchors() {
      return roots
        .filter(({ root }) => !walkRoot(root.path).some((entry) => entry.path === root.anchor))
        .map(({ name, root }) => `${name}: ${root.anchor}`);
    },
  };
}
