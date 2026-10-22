export type FileKind =
  'code' | 'declarations' | 'stylesheet' | 'rules' | 'config' | 'markdown' | 'shell';

export const FILE_KINDS: readonly FileKind[] = Object.freeze([
  'code',
  'declarations',
  'stylesheet',
  'rules',
  'config',
  'markdown',
  'shell',
]);

export type RootRole =
  'app' | 'functions' | 'sharedSource' | 'e2e' | 'hostedE2e' | 'scripts' | 'coreDist' | 'workers';

export const ROOT_ROLES: readonly RootRole[] = Object.freeze([
  'app',
  'functions',
  'sharedSource',
  'e2e',
  'hostedE2e',
  'scripts',
  'coreDist',
  'workers',
]);

export interface RootDeclaration {
  path: string;
  anchor: string;
}

export interface Reviewed {
  path: string;
  why: string;
}

export interface RepoLayout {
  repoRoot: string;
  roots: {
    app: RootDeclaration;
    functions?: RootDeclaration;
    sharedSource?: RootDeclaration;
    e2e?: RootDeclaration;
    hostedE2e?: RootDeclaration;
    scripts?: RootDeclaration;
    coreDist?: RootDeclaration;
    workers?: Readonly<Record<string, RootDeclaration>>;
  };
  rulesFiles?: readonly string[];
  firebaseConfig?: string;
  testCodePaths?: readonly Reviewed[];
  testCodeNameMarkers?: ReadonlyArray<{ marker: string; why: string }>;
  exclusions?: readonly Reviewed[];
}

export const REPOSITORY_ROOT = '.';

const SHARED_SOURCE_READERS: readonly RootRole[] = ['app', 'functions'];

export function withSharedSource(roles: readonly RootRole[]): RootRole[] {
  const out = [...roles];
  if (!out.includes('sharedSource') && roles.some((role) => SHARED_SOURCE_READERS.includes(role)))
    out.push('sharedSource');
  return out;
}

export function isUnderRoot(path: string, rootPath: string): boolean {
  return rootPath === REPOSITORY_ROOT || path === rootPath || path.startsWith(`${rootPath}/`);
}

export type RulesService = 'firestore' | 'storage';

const RULES_SERVICES: ReadonlyArray<{ service: RulesService; declaration: RegExp }> = [
  { service: 'firestore', declaration: /\bservice\s+cloud\.firestore\b/ },
  { service: 'storage', declaration: /\bservice\s+firebase\.storage\b/ },
];

export function rulesServiceOf(code: string): RulesService | null {
  const declared = RULES_SERVICES.filter(({ declaration }) => declaration.test(code));
  return declared.length === 1 ? declared[0].service : null;
}

export const SKIPPED_FOLDER_NAMES: ReadonlySet<string> = new Set(['node_modules', 'dist']);

const CODE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const DECLARATION_FILE = /\.d\.[cm]?ts$/;
const CONFIG_EXTENSIONS = ['.json', '.jsonc', '.yaml', '.yml', '.toml'];
const ENV_FILE = /(^|\.)env(\.[\w-]+)*$/;
const SHELL_EXTENSIONS = ['.sh', '.ps1', '.cmd', '.bat'];

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

export function declaredRoots(
  layout: RepoLayout,
): Array<{ role: RootRole; name: string; root: RootDeclaration }> {
  const out: Array<{ role: RootRole; name: string; root: RootDeclaration }> = [];
  for (const role of ROOT_ROLES) {
    if (role === 'workers') {
      for (const [name, root] of Object.entries(layout.roots.workers ?? {}))
        out.push({ role, name, root });
    } else {
      const root = layout.roots[role];
      if (root) out.push({ role, name: role, root });
    }
  }
  return out;
}
