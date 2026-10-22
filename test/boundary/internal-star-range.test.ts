import { describe, it, expect } from 'vitest';
import { workspacePackages } from './workspace';

const DEP_FIELDS = ['dependencies', 'peerDependencies', 'devDependencies'] as const;
const SCOPE = '@ttt-productions/';

type Manifest = {
  name?: string;
  version?: string;
} & Partial<Record<(typeof DEP_FIELDS)[number], Record<string, string>>>;

function rangesSurvivingPin(manifests: readonly Manifest[]): string[] {
  const versions = new Map<string, string>();
  for (const m of manifests) if (m.name && m.version) versions.set(m.name, m.version);

  const survivors: string[] = [];
  for (const m of manifests) {
    for (const field of DEP_FIELDS) {
      for (const [dep, range] of Object.entries(m[field] ?? {})) {
        if (dep.startsWith(SCOPE) && range === '*' && !versions.has(dep)) {
          survivors.push(`${m.name} › ${field} › ${dep}`);
        }
      }
    }
  }
  return survivors;
}

describe('boundary: internal "*" ranges', () => {
  it('every internal "*" range in a source manifest resolves to a workspace package, so publish pinning leaves none', () => {
    const manifests = workspacePackages<Manifest>().map((p) => p.manifest);
    expect(rangesSurvivingPin(manifests)).toEqual([]);
  });

  it('the check reports a seeded "*" range on a package outside the workspace', () => {
    const manifests: Manifest[] = [
      { name: '@ttt-productions/a', version: '0.1.0' },
      {
        name: '@ttt-productions/b',
        version: '0.2.0',
        dependencies: { '@ttt-productions/a': '*', '@ttt-productions/gone': '*', other: '*' },
        peerDependencies: { '@ttt-productions/missing-peer': '*' },
      },
    ];
    expect(rangesSurvivingPin(manifests)).toEqual([
      '@ttt-productions/b › dependencies › @ttt-productions/gone',
      '@ttt-productions/b › peerDependencies › @ttt-productions/missing-peer',
    ]);
  });
});
