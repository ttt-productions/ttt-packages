// Structural guard for the length-limit drift class (DJ ruling 2026-07-13).
//
// THE RULE: a user-facing/business text or count limit is declared ONCE as a
// `constants/` export, and every zod bound that enforces it DERIVES from that
// constant — `.max(MAX_X)`, never `.max(2500)`. The pre-2026-07-13 codebase carried
// two independent truth sets (constants said title 150 / description 300 / chapter
// content 2500 while the schemas + HALL_CONTENT_TEXT_FIELD_MAX said 200 / 5000 /
// 100000) — invisible drift, because the tighter UI bound always fired first.
//
// This test scans every schema source for numeric `.max(<digits>)` literals and
// compares the result against the exact allowlist below. The allowlist entries are
// the REVIEWED structural bounds with no UI twin (opaque-id caps, array fan-out
// caps, RFC-shaped fields like email 320 / URL 2048, calendar month/day, and
// admin-config singletons that exist nowhere else). Adding ANY new numeric `.max()`
// literal fails this test — if the number is a business limit, declare it in
// `src/constants/` and derive; if it is genuinely structural, add it here in the
// same PR so the exception is a conscious, reviewed decision.

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  HALL_CONTENT_TEXT_FIELD_MAX,
  MAX_WORK_PROJECT_TITLE_LENGTH,
  MAX_WORK_PROJECT_DESCRIPTION_LENGTH,
  MAX_CHAPTER_CONTENT_LENGTH,
  MAX_WORK_REALM_TITLE_LENGTH,
  MAX_WORK_REALM_DESCRIPTION_LENGTH,
} from '../src/constants/business';
import { CHARTER_LIMITS, FULL_LIMITS, ACTIVE_LIMITS } from '../src/constants/app-mode';

const PKG_ROOT = path.resolve(__dirname, '..');
const SCANNED_DIRS = ['src/schemas', 'src/doc-schemas'];

/** Reviewed structural `.max(<digits>)` literals per file (sorted ascending).
 *  Matches in comments count too — a comment asserting a stale number is drift. */
const ALLOWED_MAX_LITERALS: Record<string, number[]> = {
  'src/schemas/admin.ts': [
    1, 16, 16, 32, 64, 128, 128, 128, 128, 128, 128, 200, 200, 200, 200, 300, 300, 300,
    500, 500, 2000, 2000, 2000, 2000, 2048, 2048, 2048, 4000, 4000, 8000, 20000,
  ],
  'src/schemas/chat.ts': [20, 20, 64, 64, 128, 128, 500, 500],
  'src/schemas/hall-library.ts': [64],
  'src/schemas/ncii.ts': [64, 256, 256, 256, 256, 256, 256, 320, 1000, 4000, 4000, 8000],
  'src/schemas/notification.ts': [64, 128, 2000, 2000],
  'src/schemas/safety.ts': [200, 500, 2000],
  'src/schemas/social.ts': [128, 128],
  'src/schemas/uploads.ts': [200],
  'src/schemas/users.ts': [12, 12, 31, 31, 100],
  'src/schemas/utility.ts': [64, 64, 64, 128, 500, 500],
  'src/doc-schemas/ncii/holds.ts': [16],
  'src/doc-schemas/ncii/requests.ts': [16, 16, 16, 280],
  'src/doc-schemas/safety/case.ts': [32],
  'src/doc-schemas/safety/evidence.ts': [32, 64, 64, 256],
  'src/doc-schemas/safety/holds.ts': [32, 64, 256],
  'src/doc-schemas/safety/provenance.ts': [256],
  'src/doc-schemas/safety/report.ts': [16, 32],
  'src/doc-schemas/safety/sagas.ts': [256],
  'src/doc-schemas/system.ts': [1],
};

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walk(p));
    else if (entry.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

function collectMaxLiterals(): Record<string, number[]> {
  const found: Record<string, number[]> = {};
  for (const dir of SCANNED_DIRS) {
    for (const file of walk(path.join(PKG_ROOT, dir))) {
      const src = fs.readFileSync(file, 'utf8');
      const literals = [...src.matchAll(/\.max\((\d[\d_]*)\)/g)].map((m) =>
        Number(m[1].replace(/_/g, '')),
      );
      if (literals.length > 0) {
        const rel = path.relative(PKG_ROOT, file).split(path.sep).join('/');
        found[rel] = literals.sort((a, b) => a - b);
      }
    }
  }
  return found;
}

describe('schema length-literal guard (one variable, one number)', () => {
  it('no new numeric .max() literal appears in any schema file', () => {
    const found = collectMaxLiterals();
    const allFiles = [...new Set([...Object.keys(found), ...Object.keys(ALLOWED_MAX_LITERALS)])].sort();
    for (const file of allFiles) {
      expect(
        found[file] ?? [],
        `${file}: numeric .max() literal set changed. Business limits must be declared ONCE in src/constants/ and derived (.max(MAX_X)); only reviewed structural bounds may be literals — if this literal is genuinely structural, update ALLOWED_MAX_LITERALS consciously in the same change.`,
      ).toEqual(ALLOWED_MAX_LITERALS[file] ?? []);
    }
  });

  it('HALL_CONTENT_TEXT_FIELD_MAX derives from the owning constants (no third truth set)', () => {
    expect(HALL_CONTENT_TEXT_FIELD_MAX.title).toBe(MAX_WORK_PROJECT_TITLE_LENGTH);
    expect(HALL_CONTENT_TEXT_FIELD_MAX.description).toBe(MAX_WORK_PROJECT_DESCRIPTION_LENGTH);
    expect(HALL_CONTENT_TEXT_FIELD_MAX.content).toBe(MAX_CHAPTER_CONTENT_LENGTH);
    expect(HALL_CONTENT_TEXT_FIELD_MAX.workingTitle).toBe(MAX_WORK_REALM_TITLE_LENGTH);
    expect(HALL_CONTENT_TEXT_FIELD_MAX.workingDescription).toBe(MAX_WORK_REALM_DESCRIPTION_LENGTH);
  });

  it('chapter content is the mode-varied text limit with the ruled values (30k charter / 100k full)', () => {
    expect(CHARTER_LIMITS.workProject.maxChapterContentLength).toBe(30_000);
    expect(FULL_LIMITS.workProject.maxChapterContentLength).toBe(100_000);
    expect(MAX_CHAPTER_CONTENT_LENGTH).toBe(ACTIVE_LIMITS.workProject.maxChapterContentLength);
  });

  it('titles are 150 and descriptions 1000 platform-wide (DJ ruling 2026-07-13)', () => {
    expect(MAX_WORK_PROJECT_TITLE_LENGTH).toBe(150);
    expect(MAX_WORK_PROJECT_DESCRIPTION_LENGTH).toBe(1000);
  });
});
