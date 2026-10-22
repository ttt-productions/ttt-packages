import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './leak-utils';
import { packageOf, packageSource, packagesTree, workspacePackages } from './workspace';

interface SourceMap {
  sources?: unknown;
  sourcesContent?: unknown;
}

const mapOf = (source: string) =>
  source
    .replace(/^(packages\/[^/]+)\/src\//, '$1/dist/')
    .replace(/\.([cm]?)[jt]sx?$/, (_, kind: string) => `.${kind}js.map`);

const sourcesByPackage = new Map<string, string[]>();
for (const { path } of packageSource(['code'])) {
  const dir = packageOf(path);
  sourcesByPackage.set(dir, [...(sourcesByPackage.get(dir) ?? []), path]);
}

describe('boundary: published sourcemaps', () => {
  for (const { dir, manifest } of workspacePackages<{ name?: string }>()) {
    const packageName = manifest.name ?? dir;

    it(`${packageName} embeds every JavaScript sourcemap source`, () => {
      if (!packagesTree.exists(`packages/${dir}/dist`)) {
        console.warn(
          `[boundary] ${packageName}: dist not built; skipping sourcemap audit. Build the package first.`,
        );
        return;
      }

      const maps = (sourcesByPackage.get(dir) ?? []).map(mapOf);
      expect(maps, `${packageName} compiles no JavaScript module`).not.toHaveLength(0);

      const violations: string[] = [];
      for (const mapPath of maps) {
        const file = join(REPO_ROOT, mapPath);
        if (!existsSync(file)) {
          violations.push(
            `${mapPath} (missing — rebuild the package, or its build stopped emitting maps)`,
          );
          continue;
        }
        const map = JSON.parse(readFileSync(file, 'utf8')) as SourceMap;
        const sources = Array.isArray(map.sources) ? map.sources : [];
        const sourcesContent = Array.isArray(map.sourcesContent) ? map.sourcesContent : [];
        const hasEverySource =
          sources.length > 0 &&
          sourcesContent.length === sources.length &&
          sourcesContent.every((source) => typeof source === 'string');

        if (!hasEverySource) violations.push(mapPath);
      }

      expect(
        violations,
        `${packageName} has JavaScript sourcemaps without complete sourcesContent:\n  ${violations.join('\n  ')}`,
      ).toEqual([]);
    });
  }
});
