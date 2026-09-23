import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './leak-utils';

// lucide-react is a client-only React library (react-safety.md § Dependency safety,
// ARCH-202). A package that renders lucide icons never bundles its own copy: it
// declares lucide as an OPTIONAL peer, so the consuming app supplies the one copy
// every package renders from. One range across the workspace keeps that true — a
// package whose range drifts to another major reintroduces a second lucide install.

const LUCIDE = 'lucide-react';

interface Manifest {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

function listSource(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return listSource(path);
    return /\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts') ? [path] : [];
  });
}

const IMPORTS_LUCIDE = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]lucide-react['"]/;

const packagesDir = join(REPO_ROOT, 'packages');
const packages = readdirSync(packagesDir)
  .filter((dir) => existsSync(join(packagesDir, dir, 'package.json')))
  .map((dir) => {
    const manifest = JSON.parse(readFileSync(join(packagesDir, dir, 'package.json'), 'utf8')) as Manifest;
    const importsLucide = listSource(join(packagesDir, dir, 'src')).some((file) =>
      IMPORTS_LUCIDE.test(readFileSync(file, 'utf8')),
    );
    return { dir, manifest, importsLucide };
  });

const importers = packages.filter((p) => p.importsLucide);
const peerDeclarers = packages.filter((p) => p.manifest.peerDependencies?.[LUCIDE] !== undefined);

describe('boundary: lucide-react is one optional peer', () => {
  it('finds the packages that render lucide icons', () => {
    expect(importers.length).toBeGreaterThan(0);
  });

  it('no package takes lucide-react as a hard dependency', () => {
    const hard = packages.filter((p) => p.manifest.dependencies?.[LUCIDE] !== undefined).map((p) => p.dir);
    expect(hard, `lucide-react in "dependencies" — make it an optional peer:\n  ${hard.join('\n  ')}`).toEqual([]);
  });

  it('every package that imports lucide-react declares it as an optional peer, with a devDependency to build and test alone', () => {
    const missing = importers.flatMap(({ dir, manifest }) => [
      ...(manifest.peerDependencies?.[LUCIDE] === undefined ? [`${dir}: no ${LUCIDE} peer`] : []),
      ...(manifest.peerDependenciesMeta?.[LUCIDE]?.optional !== true ? [`${dir}: ${LUCIDE} peer is not optional`] : []),
      ...(manifest.devDependencies?.[LUCIDE] === undefined ? [`${dir}: no ${LUCIDE} devDependency`] : []),
    ]);
    expect(missing).toEqual([]);
  });

  it('only a package that imports lucide-react declares it (no dead peer or devDependency)', () => {
    const dead = packages
      .filter((p) => !p.importsLucide)
      .flatMap(({ dir, manifest }) =>
        (['dependencies', 'peerDependencies', 'devDependencies'] as const)
          .filter((field) => manifest[field]?.[LUCIDE] !== undefined)
          .map((field) => `${dir} (${field})`),
      );
    expect(dead, `lucide-react declared by a package whose source never imports it:\n  ${dead.join('\n  ')}`).toEqual([]);
  });

  it('every lucide-react range in the workspace is the same range', () => {
    const ranges = new Map<string, string[]>();
    for (const { dir, manifest } of packages) {
      for (const [field, range] of [
        ['peer', manifest.peerDependencies?.[LUCIDE]],
        ['dev', manifest.devDependencies?.[LUCIDE]],
      ] as const) {
        if (range === undefined) continue;
        ranges.set(range, [...(ranges.get(range) ?? []), `${dir} (${field})`]);
      }
    }
    expect(peerDeclarers.length).toBeGreaterThan(0);
    expect(Object.fromEntries(ranges), 'lucide-react ranges diverge across packages').toSatisfy(
      (byRange: Record<string, string[]>) => Object.keys(byRange).length === 1,
    );
  });
});
