// ============================================================================
// DEFINITION RE-DECLARATION GUARD — build-failing enforcement of Rule 36
// (extended 2026-07-13): a canonical union's distinctive member literals may not
// appear as QUOTED string literals in any package source file outside the
// union's defining file and the reviewed allowlist (typed derived usages such as
// a `Record<CanonicalType, …>` ordering array, which the compiler already
// checks). This is the union-shaped sibling of the numeric schema-literal guard.
//
// How it works: for each guarded member we scan every `packages/*/src/**/*.{ts,tsx}`
// file (dist/node_modules excluded; __tests__ excluded — fixtures legitimately use
// literals) for the EXACT quoted literal ('x', "x", `x`). A hit outside the
// allowlist means someone re-declared (or hand-mirrored) the canonical union —
// fix by importing the canonical schema/type, then rerun.
//
// Adding a NEW canonical union? Add its most distinctive member here.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGES_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

/** literal → { owner, allowed } — paths are packages-dir-relative, forward-slashed. */
const GUARDED: Record<string, { owner: string; allowed: string[] }> = {
  mimicOnTtt: {
    owner: 'ttt-core/src/doc-schemas/user.ts',
    // CRAFT_SKILL_KIND_ORDER is typed CraftSkillKind[] — compiler-checked derived usage.
    allowed: ['ttt-core/src/constants/craft-skill-statements.ts'],
  },
  mimicOffTtt: {
    owner: 'ttt-core/src/doc-schemas/user.ts',
    allowed: ['ttt-core/src/constants/craft-skill-statements.ts'],
  },
  adminWorkMessage: {
    owner: 'ttt-core/src/doc-schemas/safety/foundation.ts',
    allowed: [],
  },
  'admin-work-message': {
    owner: 'ttt-core/src/doc-schemas/safety/foundation.ts',
    // Label/multiplier maps are Record<ReportableItemType, …> — compiler-checked.
    allowed: ['ttt-core/src/report/report-config-values.ts'],
  },
  possibleMinor: {
    owner: 'ttt-core/src/doc-schemas/safety/foundation.ts',
    allowed: [],
  },
  authorizedRepresentative: {
    owner: 'ttt-core/src/doc-schemas/safety/foundation.ts',
    // Compile-checked comparison against the typed requesterRole (a typo fails tsc).
    allowed: ['ttt-core/src/doc-schemas/ncii/requests.ts'],
  },
  correctedNoApparentViolation: {
    owner: 'ttt-core/src/doc-schemas/safety/foundation.ts',
    // REPORT_DISPOSITION_OPTIONS values are typed Exclude<ReportDisposition,…> — checked.
    allowed: ['ttt-core/src/constants/admin-labels.ts'],
  },
  workFileFolder: {
    owner: 'ttt-core/src/doc-schemas/media-assets.ts',
    // The createMediaGrant wire input's OWN scopeKind discriminant intentionally names
    // the same scope kind (its union also carries request-only kinds); reviewed.
    allowed: ['ttt-core/src/schemas/media.ts'],
  },
};

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '__tests__' || name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(full);
  }
}

function packageSrcFiles(): string[] {
  const files: string[] = [];
  for (const pkg of readdirSync(PACKAGES_DIR)) {
    const src = join(PACKAGES_DIR, pkg, 'src');
    try {
      if (statSync(src).isDirectory()) walk(src, files);
    } catch {
      // no src dir — skip
    }
  }
  return files;
}

describe('canonical-union member literals appear only at their defining site', () => {
  const files = packageSrcFiles();

  it('scanned a plausible number of package source files', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  for (const [literal, { owner, allowed }] of Object.entries(GUARDED)) {
    it(`'${literal}' is declared only in ${owner} (+ reviewed allowlist)`, () => {
      const permitted = new Set([owner, ...allowed]);
      const quoted = [`'${literal}'`, `"${literal}"`, `\`${literal}\``];
      const offenders: string[] = [];
      for (const file of files) {
        const rel = relative(PACKAGES_DIR, file).split(sep).join('/');
        if (permitted.has(rel)) continue;
        const content = readFileSync(file, 'utf8');
        if (quoted.some((q) => content.includes(q))) offenders.push(rel);
      }
      expect(
        offenders,
        `Re-declared canonical member '${literal}' — import the canonical union from ${owner} instead (or, for a compiler-checked derived usage, add the file to this literal's reviewed allowlist).`,
      ).toEqual([]);
    });
  }
});
