import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './leak-utils';
import { importsOf, packageSource } from './workspace';

// FRONTEND-201 — one spinner. Every in-progress indicator renders through ui-core's
// `Spinner` (directly, or via a control's `pending` prop), so its look, size scale,
// and in-button color rule have one change point. A hand-rolled spinner is the drift
// this guard exists to catch.

const sourceFiles = packageSource(['code', 'stylesheet']);

/**
 * Whether a package can render anything: it declares React (as a dependency or peer) or ships a
 * stylesheet entry. A package that renders nothing — a guard package naming the class it bans — can
 * draw no spinner.
 */
function rendersUi(folder: string): boolean {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'packages', folder, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    exports?: Record<string, unknown>;
  };
  if (manifest.dependencies?.react || manifest.peerDependencies?.react) return true;
  return Object.keys(manifest.exports ?? {}).some((entry) => /styles|\.css$/.test(entry));
}

describe('boundary: canonical spinner', () => {
  it('scans a plausible number of package source files', () => {
    expect(sourceFiles.length).toBeGreaterThan(100);
  });

  it('allows the Loader2 icon only inside ui-core Spinner', () => {
    const allowed = 'packages/ui-core/src/react/components/spinner.tsx';
    const violations = sourceFiles
      .filter((file) => file.kind === 'code')
      .filter((file) => importsOf(file).some(({ specifier, names }) => specifier === 'lucide-react' && names.includes('Loader2')))
      .map((file) => file.path)
      .filter((file) => file !== allowed);

    expect(
      violations,
      `Loader2 imported outside ui-core Spinner — render <Spinner> or pass \`pending\`:\n  ${violations.join('\n  ')}`,
    ).toEqual([]);
  });

  it('allows the animate-spin utility nowhere (theme-core spinner classes own the animation)', () => {
    const violations = sourceFiles
      .filter((file) => !file.path.startsWith('packages/theme-core/'))
      .filter((file) => rendersUi(file.path.split('/')[1]))
      .filter((file) => /\banimate-spin\b/.test(file.code))
      .map((file) => file.path);

    expect(
      violations,
      `animate-spin outside theme-core — render <Spinner> instead:\n  ${violations.join('\n  ')}`,
    ).toEqual([]);
  });
});
