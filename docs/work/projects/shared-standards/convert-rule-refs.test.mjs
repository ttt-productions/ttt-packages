// Fixtures for convert-rule-refs.mjs, each taken from a real citation. Run:
//   node --test docs/work/projects/shared-standards/convert-rule-refs.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContext, convertText } from './convert-rule-refs.mjs';

const PACKAGES_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const SHARED_RULES = join(PACKAGES_ROOT, 'packages/dev-standards/rules');
const pkg = buildContext({ repo: 'ttt-packages', root: PACKAGES_ROOT, sharedRules: SHARED_RULES });
const prod = buildContext({ repo: 'ttt-prod', root: 'C:/DjDev/ttt-master-app', sharedRules: SHARED_RULES });

const run = (ctx, file, text) => convertText(ctx, file, text);
const out = (ctx, file, text) => run(ctx, file, text).text;

test('a bare ID resolves through the citing file\'s table', () => {
  assert.equal(
    out(pkg, 'packages/report-core/src/x.ts', '// fence (engineering-rules ARCH-001).'),
    '// fence (engineering-rules RULE-STD-ARCH-001).',
  );
  // ttt-core follows ttt-prod's rulebook, so its app rule maps to a RULE-TTT ID.
  assert.equal(
    out(pkg, 'packages/ttt-core/src/x.ts', 'never the compound code identifiers (ARCH-107). */'),
    'never the compound code identifiers (RULE-TTT-ARCH-901). */',
  );
});

test('grouped IDs map member by member', () => {
  assert.equal(
    out(pkg, 'packages/report-core/src/x.ts', ' * formula (ENG-002/ARCH-102).'),
    ' * formula (RULE-STD-ENG-002/RULE-STD-ARCH-102).',
  );
  assert.equal(
    out(prod, 'docs/x.md', 'BACKEND-301/302 and FRONTEND-201 / 205'),
    'RULE-STD-BACKEND-301/302 and RULE-STD-FRONTEND-201 / 205',
  );
});

test('a group whose members land in different prefixes is written out in full', () => {
  // ttt-prod BACKEND-006 is an app rule (RULE-TTT-BACKEND-901); BACKEND-003 is shared.
  assert.equal(out(prod, 'docs/x.md', '(BACKEND-003/006)'), '(RULE-STD-BACKEND-003/RULE-TTT-BACKEND-901)');
});

test('a range expands; a band keeps its numbers', () => {
  assert.equal(out(prod, 'docs/x.md', 'QUALITY-101–104'), 'RULE-STD-QUALITY-101–104');
  assert.equal(out(prod, 'docs/x.md', 'QUALITY-001..004'), 'RULE-STD-QUALITY-001..004');
  const band = run(prod, 'docs/x.md', '## Data and contracts (ARCH-100–199)');
  assert.equal(band.text, '## Data and contracts (RULE-STD-ARCH-100–199)');
  assert.ok(band.rewrites[0].forms.includes('band'));
  // ENG-011 is a promoted Q-Sports rule, absent from ttt-prod's table: a band, not a range.
  assert.equal(out(prod, 'docs/x.md', 'ENG-001–011'), 'RULE-STD-ENG-001–011');
});

test('a qualified ID resolves through the packages table and drops the qualifier', () => {
  assert.equal(out(prod, 'docs/x.md', 'see ttt-packages QUALITY-102.'), 'see RULE-STD-QUALITY-102.');
  assert.equal(
    out(prod, 'docs/x.md', 'ttt-packages QUALITY-102 and ARCH-201'),
    'RULE-STD-QUALITY-102 and RULE-STD-ARCH-201',
  );
});

test('IDs inside strings are rewritten', () => {
  assert.equal(
    out(pkg, 'packages/ttt-core/__tests__/x.test.ts', "it('only the TTL field is one (ARCH-105)', () => {"),
    "it('only the TTL field is one (RULE-STD-ARCH-105)', () => {",
  );
  assert.equal(
    out(prod, 'functions/src/x.ts', '// Post-commit side effect (non-blocking) — see engineering-rules BACKEND-301.'),
    '// Post-commit side effect (non-blocking) — see engineering-rules RULE-STD-BACKEND-301.',
  );
});

test('"an" before a rewritten ID becomes "a"', () => {
  assert.equal(
    out(pkg, 'docs/packages/auth-core.md', 'would be an ARCH-201 violation'),
    'would be a RULE-STD-ARCH-201 violation',
  );
});

test('a Markdown link with a rule anchor resolves through the rule table', () => {
  const text = out(prod, 'docs/design/x.md', '[ARCH-202](../engineering-rules/architecture/packages-and-boundaries.md#arch-202--x)');
  assert.match(text, /^\[RULE-STD-ARCH-202\]\(\.\.\/\.\.\/node_modules\/@ttt-productions\/dev-standards\/rules\/architecture\/packages-and-boundaries\.md#rule-std-arch-202--/);
  // An app rule's link stays on the app file, with the anchor of its new heading.
  const app = out(prod, 'docs/design/x.md', '[ARCH-107](../engineering-rules/architecture/data-and-contracts.md#arch-107--x)');
  assert.match(app, /\]\(\.\.\/engineering-rules\/architecture\/[a-z-]+\.md#rule-ttt-arch-901--/);
});

test('a relative link to a moved doc follows it', () => {
  assert.equal(
    out(prod, 'docs/design/x.md', 'see [prefs](../development-preferences.md)'),
    'see [prefs](../../node_modules/@ttt-productions/dev-standards/development-preferences.md)',
  );
});

test('a plain path and a Windows path to a moved doc follow it; a path into another repo does not', () => {
  assert.equal(
    out(pkg, 'docs/design/react-safety.md', 'see `docs/playbooks/REACT_LEAK_AUDIT_PLAYBOOK.md`.'),
    'see `packages/dev-standards/playbooks/react-leak-audit-playbook.md`.',
  );
  assert.equal(
    out(prod, 'docs/x.md', '`C:\\DjDev\\ttt-master-app\\docs\\model-tiers.md`'),
    '`C:\\DjDev\\ttt-master-app\\node_modules\\@ttt-productions\\dev-standards\\model-tiers.md`',
  );
  const other = '`C:\\DjDev\\q-sports-league\\docs\\engineering-rules\\`';
  assert.equal(out(pkg, 'docs/packages/x.md', other), other);
});

test('an ID the table does not know is left and reported', () => {
  const res = run(pkg, 'packages/ui-core/src/x.ts', '// (MEDIA-103)');
  assert.equal(res.text, '// (MEDIA-103)');
  assert.deepEqual(res.unclassified.map((u) => u.text), ['MEDIA-103']);
});

test('a second run over rewritten text changes nothing', () => {
  const once = out(prod, 'docs/x.md', 'BACKEND-003/006, QUALITY-101–104, ttt-packages QUALITY-102 and ARCH-201');
  assert.equal(out(prod, 'docs/x.md', once), once);
});
