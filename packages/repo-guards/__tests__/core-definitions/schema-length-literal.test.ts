// A core schema bound derives from a named constant: only reviewed structural .max() literals stay
// literal, each file's exact values reviewed, and no literal minimum sits above 1.

import { afterAll, describe, expect, it } from 'vitest';
import { schemaLengthLiteralGuard, type SchemaLengthLiteralFacts } from '../../src/modules/core-definitions/schema-length-literal.js';
import { CORE, fixture, lines, type Fixture } from './fixture.js';

const CLEAN: Record<string, string> = {
  [`${CORE}/schemas/admin.js`]: [
    'export const A = z.object({',
    '  id: z.string().min(1).max(128),',
    '  title: z.string().max(MAX_TITLE_LENGTH),',
    "  note: z.string().min(1, 'required'),",
    '});',
    '// .max(999) named in prose',
  ].join('\n'),
  [`${CORE}/doc-schemas/safety.js`]: 'export const B = z.object({ a: z.array(x).max(200), b: z.string().max( 1_6 ) });',
  [`${CORE}/constants/limits.js`]: 'export const C = z.string().max(5).min(3);',
};

const facts = (overrides: Partial<SchemaLengthLiteralFacts> = {}): SchemaLengthLiteralFacts => ({
  schemaFolders: [`${CORE}/schemas`, `${CORE}/doc-schemas`],
  reviewedMaxLiterals: [
    { file: `${CORE}/schemas/admin.js`, values: [128], why: 'an opaque-id cap' },
    { file: `${CORE}/doc-schemas/safety.js`, values: [16, 200], why: 'a fan-out count and a code length' },
  ],
  ...overrides,
});

const opened: Fixture[] = [];
const open = (files: Record<string, string>) => {
  const f = fixture({ ...CLEAN, ...files });
  opened.push(f);
  return f;
};
afterAll(() => opened.forEach((f) => f.repo.remove()));

describe('literal .max() bounds', () => {
  it('passes the reviewed bounds, a bound derived from a constant, prose, and a module outside the schema folders', async () => {
    const [maxGuard] = schemaLengthLiteralGuard.build(facts());
    expect(lines(await open({}).run(maxGuard))).toEqual([]);
  });

  it('FLAGS a new literal bound, a reviewed value no longer present, a reviewed module outside the folders, and an empty folder', async () => {
    const [maxGuard] = schemaLengthLiteralGuard.build(
      facts({
        schemaFolders: [`${CORE}/schemas`, `${CORE}/doc-schemas`, `${CORE}/media`],
        reviewedMaxLiterals: [
          { file: `${CORE}/schemas/admin.js`, values: [128, 128], why: 'two opaque-id caps' },
          { file: `${CORE}/doc-schemas/safety.js`, values: [16, 200], why: 'a fan-out count and a code length' },
          { file: `${CORE}/constants/limits.js`, values: [5], why: 'reviewed in the wrong folder' },
        ],
      }),
    );
    const f = open({ [`${CORE}/doc-schemas/safety.js`]: 'export const B = z.object({\n  a: z.array(x).max(200),\n  b: z.string().max(16),\n  c: z.string().max(2500),\n});' });
    expect(lines(await f.run(maxGuard)).sort()).toEqual([
      `${CORE}/media — the folder holds no compiled module of the core build (moved, or outside the core build root)`,
      `${CORE}/doc-schemas/safety.js:4 — .max(2500) is a literal bound not on the reviewed list`,
      `${CORE}/schemas/admin.js — stale reviewed bound: .max(128) is no longer in the file`,
      `${CORE}/constants/limits.js — stale reviewed entry: the module is gone or outside the schema folders`,
    ].sort());
  });
});

describe('literal .min() bounds', () => {
  it('passes a minimum of 1 and leaves modules outside the schema folders alone', async () => {
    const [, minGuard] = schemaLengthLiteralGuard.build(facts());
    expect(lines(await open({}).run(minGuard))).toEqual([]);
  });

  it('FLAGS a literal minimum above 1, with or without a message', async () => {
    const [, minGuard] = schemaLengthLiteralGuard.build(facts());
    const f = open({ [`${CORE}/schemas/users.js`]: "export const U = z.object({\n  name: z.string().min(3),\n  bio: z.string().min(10, 'too short'),\n});" });
    expect(lines(await f.run(minGuard))).toEqual([
      `${CORE}/schemas/users.js:2 — .min(3) is a literal minimum`,
      `${CORE}/schemas/users.js:3 — .min(10) is a literal minimum`,
    ]);
  });
});

describe('the facts', () => {
  it('refuses no schema folder, a reviewed entry with no values or no why, and a module listed twice', () => {
    expect(
      schemaLengthLiteralGuard.factProblems({
        schemaFolders: [],
        reviewedMaxLiterals: [
          { file: 'a.js', values: [], why: 'x' },
          { file: 'b.js', values: [1.5], why: '' },
          { file: 'b.js', values: [1], why: 'y' },
        ],
      }),
    ).toEqual([
      'schemaFolders is empty',
      'reviewedMaxLiterals entry a.js needs its reviewed values, each a whole number',
      'reviewedMaxLiterals entry b.js carries no why',
      'reviewedMaxLiterals entry b.js needs its reviewed values, each a whole number',
      'reviewedMaxLiterals entry b.js is listed twice',
    ]);
  });
});
