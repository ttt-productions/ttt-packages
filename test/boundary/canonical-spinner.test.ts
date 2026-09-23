import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REPO_ROOT } from './leak-utils';

// FRONTEND-201 — one spinner. Every in-progress indicator renders through ui-core's
// `Spinner` (directly, or via a control's `pending` prop), so its look, size scale,
// and in-button color rule have one change point. A hand-rolled spinner is the drift
// this guard exists to catch.

function listSource(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...listSource(path));
    else if (/\.(ts|tsx|css)$/.test(entry) && !entry.endsWith('.d.ts')) files.push(path);
  }
  return files;
}

const packagesDir = join(REPO_ROOT, 'packages');
const sourceFiles = readdirSync(packagesDir).flatMap((packageName) => listSource(join(packagesDir, packageName, 'src')));
const rel = (file: string) => relative(REPO_ROOT, file).replace(/\\/g, '/');

describe('boundary: canonical spinner', () => {
  it('scans a plausible number of package source files', () => {
    expect(sourceFiles.length).toBeGreaterThan(100);
  });

  it('allows the Loader2 icon only inside ui-core Spinner', () => {
    const allowed = 'packages/ui-core/src/react/components/spinner.tsx';
    const violations = sourceFiles
      .filter((file) => /import\s*\{[^}]*\bLoader2\b[^}]*\}\s*from\s*['"]lucide-react['"]/.test(readFileSync(file, 'utf8')))
      .map(rel)
      .filter((file) => file !== allowed);

    expect(
      violations,
      `Loader2 imported outside ui-core Spinner — render <Spinner> or pass \`pending\`:\n  ${violations.join('\n  ')}`,
    ).toEqual([]);
  });

  it('allows the animate-spin utility nowhere (theme-core spinner classes own the animation)', () => {
    const violations = sourceFiles
      .filter((file) => !rel(file).startsWith('packages/theme-core/'))
      .filter((file) => /\banimate-spin\b/.test(readFileSync(file, 'utf8')))
      .map(rel);

    expect(
      violations,
      `animate-spin outside theme-core — render <Spinner> instead:\n  ${violations.join('\n  ')}`,
    ).toEqual([]);
  });
});
