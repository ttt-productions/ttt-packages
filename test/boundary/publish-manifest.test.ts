import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './leak-utils';

// A package tarball carries its compiled `dist` plus any stylesheet folder a `./styles` export points
// into, never TypeScript source: the maps already embed their sources. prepublishOnly cleans before
// it builds, so a file the source no longer produces (a moved test, a deleted module) never ships
// from a stale dist.

const PREPUBLISH = 'npm run clean && npm run build';
const CLEANS_DIST = /\brm -rf\b[^&|;]*\bdist\b/;
const TS_SOURCE = /\.[cm]?tsx?$/;

interface Manifest {
  files?: string[];
  scripts?: Record<string, string>;
}

function listFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((entry) => listFiles(join(path, entry)));
}

const packagesDir = join(REPO_ROOT, 'packages');
const packages = readdirSync(packagesDir)
  .filter((dir) => existsSync(join(packagesDir, dir, 'package.json')))
  .map((dir) => ({
    dir,
    manifest: JSON.parse(readFileSync(join(packagesDir, dir, 'package.json'), 'utf8')) as Manifest,
  }));

describe('boundary: every package publishes a clean build and no source', () => {
  it('finds the workspace packages', () => {
    expect(packages.length).toBeGreaterThan(0);
  });

  it(`every prepublishOnly is "${PREPUBLISH}", and every clean script removes dist`, () => {
    const wrong = packages.flatMap(({ dir, manifest }) => [
      ...(manifest.scripts?.prepublishOnly !== PREPUBLISH ? [`${dir}: prepublishOnly is not "${PREPUBLISH}"`] : []),
      ...(!CLEANS_DIST.test(manifest.scripts?.clean ?? '') ? [`${dir}: clean does not remove dist`] : []),
    ]);
    expect(wrong).toEqual([]);
  });

  it('every package publishes dist, and no other files entry holds TypeScript source', () => {
    const wrong = packages.flatMap(({ dir, manifest }) => {
      const files = manifest.files ?? [];
      return [
        ...(files.includes('dist') ? [] : [`${dir}: files does not list "dist"`]),
        ...files
          .filter((entry) => entry !== 'dist')
          .flatMap((entry) => {
            const path = join(packagesDir, dir, entry);
            if (!existsSync(path)) return [`${dir}: files entry "${entry}" matches nothing on disk`];
            return listFiles(path).some((file) => TS_SOURCE.test(file))
              ? [`${dir}: files entry "${entry}" ships TypeScript source`]
              : [];
          }),
      ];
    });
    expect(wrong).toEqual([]);
  });
});
