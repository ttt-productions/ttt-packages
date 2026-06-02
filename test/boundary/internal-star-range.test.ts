// Check #2 — Internal "*" range audit (REPORT-ONLY against source manifests).
//
// Scans dependencies, peerDependencies, and devDependencies of every package
// manifest for `@ttt-productions/*: "*"`.
//
// Source manifests legitimately carry "*" so workspace dev resolves to the
// local package. At pack time scripts/pin-internal-deps.mjs rewrites these
// to exact versions; CI enforces the HARD-FAIL against packed/published
// output. That hard-fail belongs to the release/CI flow, NOT here — so this
// check only REPORTS against source and never fails.

import { describe, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './leak-utils';

const DEP_FIELDS = ['dependencies', 'peerDependencies', 'devDependencies'] as const;

describe('boundary: internal "*" range audit (report-only)', () => {
  it('reports any @ttt-productions/* "*" ranges in source manifests', () => {
    const pkgsDir = join(REPO_ROOT, 'packages');
    const found: string[] = [];

    for (const folder of readdirSync(pkgsDir)) {
      const pj = join(pkgsDir, folder, 'package.json');
      if (!existsSync(pj)) continue;
      const json = JSON.parse(readFileSync(pj, 'utf8'));
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
        `[boundary] internal "*" ranges in source (expected pre-release; rewritten to exact pins at pack time by scripts/pin-internal-deps.mjs):\n  ${found.join('\n  ')}`,
      );
    }
    // Intentionally no assertion — the hard-fail lives in the release flow
    // (packed tarball inspection), not against source manifests.
  });
});
