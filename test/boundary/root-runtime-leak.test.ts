// Check #1 — Root runtime-leak audit.
//
// For every package whose root is supposed to be pure/server-safe, fail if its
// built root entry (dist/index.js) transitively pulls a client/browser runtime
// import (react, firebase/{app,auth,firestore,storage,functions}, next,
// @tanstack/react-query, lucide-react, or any *.css).
//
// Drive: an explicit per-package allowlist (leak-config.ts). Type-only imports
// are resolved as clean because we read built output (tsc erases them).
//
// Set BOUNDARY_REPORT_ONLY=1 to sweep every package in report-only mode and
// print the full leak inventory without failing — used to scope the
// firebase-helpers / auth-core purification work before flipping them to 'hard'.

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { REPO_ROOT, auditRootLeaks } from './leak-utils';
import { PACKAGE_LEAK_RULES } from './leak-config';

const REPORT_ONLY = process.env.BOUNDARY_REPORT_ONLY === '1';

function pkgName(dir: string): string {
  const pj = join(dir, 'package.json');
  if (!existsSync(pj)) return dir;
  return JSON.parse(readFileSync(pj, 'utf8')).name ?? dir;
}

describe('boundary: root runtime-leak audit', () => {
  for (const rule of PACKAGE_LEAK_RULES) {
    if (rule.mode === 'exempt') continue;
    const dir = join(REPO_ROOT, 'packages', rule.dir);
    const name = pkgName(dir);

    it(`${name} root entry is free of client/runtime leaks`, () => {
      const { missing, leaks, entry } = auditRootLeaks(dir);
      const allowed = new Set(rule.allow ?? []);
      const real = leaks.filter((l) => !allowed.has(l));

      if (missing) {
        // dist not built — cannot audit. Warn rather than fail so a bare
        // `vitest run` without a prior build does not produce false failures.
        console.warn(
          `[boundary] ${name}: root entry not built (${entry ?? 'no entry'}); skipping leak audit. Build the package first.`,
        );
        return;
      }

      if (real.length > 0) {
        console.warn(`[boundary] ${name} root leaks: ${real.join(', ')}`);
      }

      if (!REPORT_ONLY && rule.mode === 'hard') {
        expect(
          real,
          `${name} root pulls forbidden client/runtime imports: ${real.join(', ')}`,
        ).toEqual([]);
      }
    });
  }
});
