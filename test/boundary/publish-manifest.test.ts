import { describe, expect, it } from 'vitest';
import { filesOf, packagesTree, workspacePackages } from './workspace';

const PREPUBLISH = 'npm run clean && npm run build';
const CLEANS_DIST = /\brm -rf\b[^&|;]*\bdist\b/;
const TS_SOURCE = /\.[cm]?tsx?$/;

interface Manifest {
  files?: string[];
  scripts?: Record<string, string>;
}

const packages = workspacePackages<Manifest>();
const typeScriptFiles = filesOf(packagesTree, ['code', 'declarations']).filter((file) =>
  TS_SOURCE.test(file.path),
);

describe('boundary: every package publishes a clean build and no source', () => {
  it('finds the workspace packages', () => {
    expect(packages.length).toBeGreaterThan(0);
  });

  it(`every prepublishOnly is "${PREPUBLISH}", and every clean script removes dist`, () => {
    const wrong = packages.flatMap(({ dir, manifest }) => [
      ...(manifest.scripts?.prepublishOnly !== PREPUBLISH
        ? [`${dir}: prepublishOnly is not "${PREPUBLISH}"`]
        : []),
      ...(!CLEANS_DIST.test(manifest.scripts?.clean ?? '')
        ? [`${dir}: clean does not remove dist`]
        : []),
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
            const path = `packages/${dir}/${entry}`;
            if (!packagesTree.exists(path))
              return [`${dir}: files entry "${entry}" matches nothing on disk`];
            return typeScriptFiles.some(
              (file) => file.path === path || file.path.startsWith(`${path}/`),
            )
              ? [`${dir}: files entry "${entry}" ships TypeScript source`]
              : [];
          }),
      ];
    });
    expect(wrong).toEqual([]);
  });
});
