// Internal "*" range audit (REPORT-ONLY against source manifests).
//
// Scans dependencies, peerDependencies, and devDependencies of every package
// manifest for `@ttt-productions/*: "*"`.
//
// Source manifests legitimately carry "*" so workspace dev resolves to the
// local package. At pack time scripts/pin-internal-deps.mjs rewrites these
// to caret ranges (^x.y.z); CI enforces the HARD-FAIL against packed/published
// output. That hard-fail belongs to the release/CI flow, NOT here — so this
// check only REPORTS against source and never fails.

import { describe, it } from 'vitest';
import { workspacePackages } from './workspace';

const DEP_FIELDS = ['dependencies', 'peerDependencies', 'devDependencies'] as const;

describe('boundary: internal "*" range audit (report-only)', () => {
  it('reports any @ttt-productions/* "*" ranges in source manifests', () => {
    const found: string[] = [];

    for (const { manifest: json } of workspacePackages<Record<string, any>>()) {
      for (const field of DEP_FIELDS) {
        const deps = json[field] as Record<string, string> | undefined;
        if (!deps) continue;
        for (const [dep, range] of Object.entries(deps)) {
          if (dep.startsWith('@ttt-productions/') && range === '*') {
            found.push(`${json.name} › ${field} › ${dep}`);
          }
        }
      }
    }

    if (found.length > 0) {
      console.warn(
        `[boundary] internal "*" ranges in source (expected pre-release; rewritten to caret ranges at pack time by scripts/pin-internal-deps.mjs):\n  ${found.join('\n  ')}`,
      );
    }
    // Intentionally no assertion — the hard-fail lives in the release flow
    // (packed tarball inspection), not against source manifests.
  });
});
