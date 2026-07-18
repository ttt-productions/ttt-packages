// Check #4 — Published JavaScript sourcemaps are self-contained.
//
// Package tarballs generally publish dist without src. Every emitted .js.map
// therefore needs sourcesContent so consumers do not resolve missing source
// paths or lose the original TypeScript in stack traces.

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REPO_ROOT } from './leak-utils';

interface SourceMap {
  sources?: unknown;
  sourcesContent?: unknown;
}

function listJavaScriptSourceMaps(dir: string): string[] {
  const maps: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      maps.push(...listJavaScriptSourceMaps(path));
    } else if (entry.endsWith('.js.map')) {
      maps.push(path);
    }
  }
  return maps;
}

describe('boundary: published sourcemaps', () => {
  const packagesDir = join(REPO_ROOT, 'packages');

  for (const packageDir of readdirSync(packagesDir)) {
    const manifestPath = join(packagesDir, packageDir, 'package.json');
    if (!existsSync(manifestPath)) continue;

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { name?: string };
    const packageName = manifest.name ?? packageDir;

    it(`${packageName} embeds every JavaScript sourcemap source`, () => {
      const distDir = join(packagesDir, packageDir, 'dist');
      if (!existsSync(distDir)) {
        console.warn(
          `[boundary] ${packageName}: dist not built; skipping sourcemap audit. Build the package first.`,
        );
        return;
      }

      const maps = listJavaScriptSourceMaps(distDir);
      expect(maps, `${packageName} emitted no JavaScript sourcemaps`).not.toHaveLength(0);

      const violations: string[] = [];
      for (const mapPath of maps) {
        const map = JSON.parse(readFileSync(mapPath, 'utf8')) as SourceMap;
        const sources = Array.isArray(map.sources) ? map.sources : [];
        const sourcesContent = Array.isArray(map.sourcesContent) ? map.sourcesContent : [];
        const hasEverySource =
          sources.length > 0 &&
          sourcesContent.length === sources.length &&
          sourcesContent.every((source) => typeof source === 'string');

        if (!hasEverySource) {
          violations.push(relative(REPO_ROOT, mapPath).replace(/\\/g, '/'));
        }
      }

      expect(
        violations,
        `${packageName} has JavaScript sourcemaps without complete sourcesContent:\n  ${violations.join('\n  ')}`,
      ).toEqual([]);
    });
  }
});
