import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// A server (Cloud Functions) installs theme-core for its server-safe root (`THEME_NAMES`), and its
// lockfile must hold no React (ARCH-202). npm installs every dependency and every required peer, so
// nothing theme-core declares that way may be React or need React: React and every React library
// `./react` uses are optional peers the app supplies.

interface Manifest {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(PACKAGE_DIR, '..', '..');
const REACT = new Set(['react', 'react-dom']);

const readManifest = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Manifest;
const manifest = readManifest(join(PACKAGE_DIR, 'package.json'));

function installedManifest(name: string): Manifest {
  for (const dir of [join(PACKAGE_DIR, 'node_modules', name), join(REPO_ROOT, 'node_modules', name)]) {
    if (existsSync(join(dir, 'package.json'))) return readManifest(join(dir, 'package.json'));
  }
  throw new Error(`${name} is not installed`);
}

const requiredPeers = (m: Manifest) =>
  Object.keys(m.peerDependencies ?? {}).filter((name) => m.peerDependenciesMeta?.[name]?.optional !== true);

/** What a server-only install of a package with this manifest is forced to install beside it. */
const forcedInstalls = (m: Manifest) => [...Object.keys(m.dependencies ?? {}), ...requiredPeers(m)];

/** Whether installing `name` installs React, through its own dependencies or required peers. */
function pullsReact(name: string, seen = new Set<string>()): boolean {
  if (REACT.has(name)) return true;
  if (seen.has(name)) return false;
  seen.add(name);
  return forcedInstalls(installedManifest(name)).some((dep) => pullsReact(dep, seen));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

const IMPORT = /(?:^|[\s;])(?:import|export)\s(?!type\s)[^'"]*?from\s*['"]([^'"./][^'"]*)['"]/g;
const packageName = (specifier: string) =>
  specifier.split('/').slice(0, specifier.startsWith('@') ? 2 : 1).join('/');

const importedPackages = new Set(
  sourceFiles(join(PACKAGE_DIR, 'src')).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(IMPORT)].map(([, specifier]) => packageName(specifier)),
  ),
);

describe('a server-only install of theme-core', () => {
  it('reads the packages its source imports (not vacuous)', () => {
    expect(importedPackages).toContain('react');
    expect(importedPackages).toContain('next-themes');
  });

  it('is forced to install nothing that is or needs React', () => {
    expect(forcedInstalls(manifest).filter((name) => pullsReact(name))).toEqual([]);
  });

  it('gets every React-dependent package its source imports as an optional peer', () => {
    const reactDependent = [...importedPackages].filter((name) => pullsReact(name));
    const notOptionalPeers = reactDependent.filter(
      (name) =>
        manifest.peerDependencies?.[name] === undefined || manifest.peerDependenciesMeta?.[name]?.optional !== true,
    );
    expect(notOptionalPeers).toEqual([]);
  });
});
