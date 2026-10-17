// What an app tells the reader about its repository: where each root is, what is test code, and
// what is never read. The reader's scope policy is fixed here; an app supplies only facts.

/** Every kind of file a guard can ask for. */
export type FileKind = 'code' | 'declarations' | 'stylesheet' | 'rules' | 'config' | 'markdown' | 'shell';

export const FILE_KINDS: readonly FileKind[] = Object.freeze([
  'code',
  'declarations',
  'stylesheet',
  'rules',
  'config',
  'markdown',
  'shell',
]);

/** The roles a root can play. `workers` is a family: an app declares each Worker tree by name. */
export type RootRole = 'app' | 'functions' | 'e2e' | 'hostedE2e' | 'scripts' | 'coreDist' | 'workers';

export const ROOT_ROLES: readonly RootRole[] = Object.freeze([
  'app',
  'functions',
  'e2e',
  'hostedE2e',
  'scripts',
  'coreDist',
  'workers',
]);

/**
 * One root: a folder, or `.` for the whole repository. `anchor` is a long-lived file under it that
 * every scan of the root must reach: a walk that stopped descending reports nothing and would read as
 * a clean tree, and the anchor is what makes that visible.
 */
export interface RootDeclaration {
  path: string;
  anchor: string;
}

/** A reviewed entry: what it names, and the one line that says why. */
export interface Reviewed {
  path: string;
  why: string;
}

export interface RepoLayout {
  /** Absolute path of the repository root. Every other path is repo-relative and forward-slashed. */
  repoRoot: string;
  roots: {
    app: RootDeclaration;
    functions?: RootDeclaration;
    e2e?: RootDeclaration;
    hostedE2e?: RootDeclaration;
    scripts?: RootDeclaration;
    /** The app's installed core package build, read as declarations and code. */
    coreDist?: RootDeclaration;
    workers?: Readonly<Record<string, RootDeclaration>>;
  };
  /**
   * Every rules file the app deploys, repo-relative: the one list every rules guard reads. Each file
   * is a Firestore or a Storage rules file by the service it declares.
   */
  rulesFiles?: readonly string[];
  /** Folders or files that hold test code beside a `__tests__` folder or a test-named file. */
  testCodePaths?: readonly Reviewed[];
  /** File-name markers that make a file test code (`.test-helper.`), each with its why. */
  testCodeNameMarkers?: ReadonlyArray<{ marker: string; why: string }>;
  /** Folders or files never read. An entry that no longer exists is stale and fails. */
  exclusions?: readonly Reviewed[];
}

/** The repository root as a root path. */
export const REPOSITORY_ROOT = '.';

/** Whether a repo-relative path is the root path or lies under it. */
export function isUnderRoot(path: string, rootPath: string): boolean {
  return rootPath === REPOSITORY_ROOT || path === rootPath || path.startsWith(`${rootPath}/`);
}

/** The service a rules file is written for. */
export type RulesService = 'firestore' | 'storage';

const RULES_SERVICES: ReadonlyArray<{ service: RulesService; declaration: RegExp }> = [
  { service: 'firestore', declaration: /\bservice\s+cloud\.firestore\b/ },
  { service: 'storage', declaration: /\bservice\s+firebase\.storage\b/ },
];

/**
 * The service a rules file declares, read from its comment-blanked code, or null when it declares
 * neither or both — such a file cannot be handed to the right guards.
 */
export function rulesServiceOf(code: string): RulesService | null {
  const declared = RULES_SERVICES.filter(({ declaration }) => declaration.test(code));
  return declared.length === 1 ? declared[0].service : null;
}

/** Dependency, build, and dot folders are skipped by name at every depth; nothing else is. */
export const SKIPPED_FOLDER_NAMES: ReadonlySet<string> = new Set(['node_modules', 'dist']);

const CODE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const DECLARATION_FILE = /\.d\.[cm]?ts$/;
const CONFIG_EXTENSIONS = ['.json', '.jsonc', '.yaml', '.yml', '.toml'];
// An env file is any name with `env` as a dot-separated part that carries no other kind's extension:
// `.env`, `.env.local`, `temp.env.dev`, `app.env`.
const ENV_FILE = /(^|\.)env(\.[\w-]+)*$/;
const SHELL_EXTENSIONS = ['.sh', '.ps1', '.cmd', '.bat'];

/** The kind of a file by its name, or null when no guard reads that kind of file. */
export function kindOfFile(name: string): FileKind | null {
  if (DECLARATION_FILE.test(name)) return 'declarations';
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot) : '';
  if (CODE_EXTENSIONS.includes(ext)) return 'code';
  if (ext === '.css') return 'stylesheet';
  if (ext === '.rules') return 'rules';
  if (CONFIG_EXTENSIONS.includes(ext)) return 'config';
  if (ext === '.md') return 'markdown';
  if (SHELL_EXTENSIONS.includes(ext)) return 'shell';
  if (ENV_FILE.test(name)) return 'config';
  return null;
}

const TEST_NAME = /\.(test|spec)\.[^/]+$/;

/**
 * True when `path` is test code under the layout's policy: a `.test.` / `.spec.` name, anything in a
 * `__tests__` folder, anything under an end-to-end root (those trees hold nothing but tests and their
 * helpers), or a declared test-code path or name marker.
 */
export function isTestPath(layout: RepoLayout, path: string): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1);
  for (const root of [layout.roots.e2e, layout.roots.hostedE2e]) {
    if (root && isUnderRoot(path, root.path)) return true;
  }
  if (TEST_NAME.test(name)) return true;
  if (path.split('/').includes('__tests__')) return true;
  if ((layout.testCodeNameMarkers ?? []).some(({ marker }) => name.includes(marker))) return true;
  return (layout.testCodePaths ?? []).some(({ path: p }) => path === p || path.startsWith(`${p}/`));
}

/** Every root the layout declares, flattened: a Worker root carries its name. */
export function declaredRoots(layout: RepoLayout): Array<{ role: RootRole; name: string; root: RootDeclaration }> {
  const out: Array<{ role: RootRole; name: string; root: RootDeclaration }> = [];
  for (const role of ROOT_ROLES) {
    if (role === 'workers') {
      for (const [name, root] of Object.entries(layout.roots.workers ?? {})) out.push({ role, name, root });
    } else {
      const root = layout.roots[role];
      if (root) out.push({ role, name: role, root });
    }
  }
  return out;
}
