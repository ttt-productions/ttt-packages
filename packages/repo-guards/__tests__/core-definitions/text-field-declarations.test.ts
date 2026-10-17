// Every typed text field is declared once in the core's declarations module and every wire schema
// reads it through the field-schema builder: no undeclared free-text property, no self-bounded
// wire string, no declaration elsewhere, keep-as-typed only where reviewed, and every field trims
// and refuses blank text when it requires text.

import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  textFieldDeclarationsGuard,
  type TextFieldDeclarationFacts,
} from '../../src/modules/core-definitions/text-field-declarations.js';
import { CORE, fixture, lines, type Fixture } from './fixture.js';

const CLEAN: Record<string, string> = {
  [`${CORE}/schemas/admin.js`]: [
    'export const RenameInputSchema = z.object({ title: textFieldSchema(TITLE_INPUT) });',
    'export const SearchInputSchema = z.object({ query: z.string().trim().max(MAX_QUERY_LENGTH) });',
    'export const LinkInputSchema = z.object({ url: z.string().url(), contactName: z.string().email() });',
    'export const ThingIdHolder = z.string().max(MAX_THING_ID_LENGTH);',
    'export const StoredShape = z.object({ title: z.string() });',
  ].join('\n'),
  [`${CORE}/constants/text-fields.js`]: [
    "export const TITLE_INPUT = defineInputFormat({ format: 'plain', min: 1, max: 10 });",
    "export const LEGAL_INPUT = defineInputFormat({ format: 'plain', min: 1, max: 10, keepAsTyped: true });",
  ].join('\n'),
  [`${CORE}/constants/other.js`]: '// keepAsTyped is set only beside the declarations\nexport const OTHER = 1;',
};

type Decl = { format: string; min: number; max: number; keepAsTyped?: true };
const DECLARATIONS: Record<string, unknown> = {
  TITLE_INPUT: { format: 'plain', min: 1, max: 10 },
  NOTE_INPUT: { format: 'plain', min: 0, max: 10 },
  LEGAL_INPUT: { format: 'plain', min: 1, max: 10, keepAsTyped: true },
  MAX_TITLE: 10,
};
const fieldSchema = (d: Decl) =>
  d.keepAsTyped ? z.string().refine((s) => s.trim().length >= d.min).pipe(z.string().max(d.max)) : z.string().trim().min(d.min).max(d.max);

const facts = (overrides: Partial<TextFieldDeclarationFacts> = {}): TextFieldDeclarationFacts => ({
  wireFolders: [`${CORE}/schemas`],
  declarationsFile: `${CORE}/constants/text-fields.js`,
  wireInputNameSuffixes: ['InputSchema'],
  selfBounded: [{ file: `${CORE}/schemas/admin.js`, declaration: 'SearchInputSchema', count: 1, why: 'a search box, not a declared field' }],
  undeclaredFreeText: [{ file: `${CORE}/schemas/admin.js`, declaration: 'SearchInputSchema', count: 1, why: 'a search box, not a declared field' }],
  keepAsTyped: [{ declaration: 'LEGAL_INPUT', why: 'a legal text whose exact characters matter' }],
  declarations: () => DECLARATIONS,
  fieldSchema: () => fieldSchema as never,
  ...overrides,
});

const opened: Fixture[] = [];
const open = (files: Record<string, string>) => {
  const f = fixture({ ...CLEAN, ...files });
  opened.push(f);
  return f;
};
afterAll(() => opened.forEach((f) => f.repo.remove()));

const guards = (overrides?: Partial<TextFieldDeclarationFacts>) => textFieldDeclarationsGuard.build(facts(overrides));

describe('wire schemas', () => {
  it('passes declared fields, built-in formats, an id-length bound, a reviewed search box, and shapes no client sends', async () => {
    const f = open({});
    const [freeText, selfBounded, declaredOnce] = guards();
    expect(lines(await f.run(freeText))).toEqual([]);
    expect(lines(await f.run(selfBounded))).toEqual([]);
    expect(lines(await f.run(declaredOnce))).toEqual([]);
  });

  it('FLAGS a bare required reason with no declaration, and a reviewed count that no longer matches', async () => {
    const [freeText] = guards();
    const f = open({
      [`${CORE}/schemas/admin.js`]: [
        'export const HideThingInputSchema = z.object({ thingId: idSchema, reason: z.string().min(1) });',
        'export const SearchInputSchema = z.object({ query: textFieldSchema(QUERY_INPUT) });',
      ].join('\n'),
    });
    expect(lines(await f.run(freeText))).toEqual([
      `${CORE}/schemas/admin.js:1 — an undeclared free-text z.string() property in HideThingInputSchema`,
      `${CORE}/schemas/admin.js — stale reviewed count for ${CORE}/schemas/admin.js#SearchInputSchema: reviewed 1, found 0`,
    ]);
  });

  it('FLAGS a wire string that trims itself, one bounded by a text-length constant, and one beyond its reviewed count', async () => {
    const [, selfBounded] = guards();
    const f = open({
      [`${CORE}/schemas/admin.js`]: [
        'export const StoredShape = z.object({',
        '  title: z.string().max(MAX_TITLE_LENGTH),',
        '  label: z.string().trim(),',
        '});',
        'export const SearchInputSchema = z.object({ query: z.string().trim().max(MAX_QUERY_LENGTH), q2: z.string().min(MIN_QUERY_LENGTH) });',
      ].join('\n'),
    });
    expect(lines(await f.run(selfBounded))).toEqual([
      `${CORE}/schemas/admin.js:2 — a self-bounded z.string() chain in StoredShape`,
      `${CORE}/schemas/admin.js:3 — a self-bounded z.string() chain in StoredShape`,
      `${CORE}/schemas/admin.js:5 — a self-bounded z.string() chain in SearchInputSchema beyond the 1 reviewed`,
    ]);
  });

  it('FLAGS a wire folder with no module', async () => {
    const [freeText] = guards({ wireFolders: [`${CORE}/schemas`, `${CORE}/media`] });
    expect(lines(await open({}).run(freeText))).toEqual([
      `${CORE}/media — the folder holds no compiled module of the core build (moved, or outside the core build root)`,
    ]);
  });
});

describe('the declarations module', () => {
  it('FLAGS defineInputFormat called and keepAsTyped set outside it, and a declarations module missing from the build', async () => {
    const [, , declaredOnce] = guards({ declarationsFile: `${CORE}/constants/fields.js` });
    const f = open({ [`${CORE}/schemas/extra.js`]: "export const X_INPUT = defineInputFormat({ format: 'plain', keepAsTyped: true });" });
    expect(lines(await f.run(declaredOnce))).toEqual([
      `${CORE}/constants/fields.js — the declarations module is not in the core build`,
      `${CORE}/constants/text-fields.js:1 — defineInputFormat outside the declarations module`,
      `${CORE}/constants/text-fields.js:2 — defineInputFormat outside the declarations module`,
      `${CORE}/constants/text-fields.js:2 — keepAsTyped outside the declarations module`,
      `${CORE}/schemas/extra.js:1 — defineInputFormat outside the declarations module`,
      `${CORE}/schemas/extra.js:1 — keepAsTyped outside the declarations module`,
    ]);
  });
});

describe('declared fields at run time', () => {
  it('passes reviewed keep-as-typed fields, trimmed fields, and required fields that refuse blank text', async () => {
    const f = open({});
    const [, , , keep, behave] = guards();
    expect(lines(await f.run(keep))).toEqual([]);
    expect(lines(await f.run(behave))).toEqual([]);
  });

  it('FLAGS a field that newly keeps its text as typed, and a reviewed one that no longer does', async () => {
    const [, , , keep] = guards({ keepAsTyped: [{ declaration: 'TITLE_INPUT', why: 'reviewed once' }] });
    expect(lines(await open({}).run(keep))).toEqual([
      '(core) LEGAL_INPUT — keeps its text as typed without review',
      '(core) TITLE_INPUT — stale keep-as-typed entry: the declaration no longer keeps its text, or is gone',
    ]);
  });

  it('FLAGS a required field that accepts whitespace-only text and a field that does not trim', async () => {
    const untrimmed = (d: Decl) => (d.keepAsTyped ? fieldSchema(d) : z.string().max(d.max));
    const [, , , , behave] = guards({ fieldSchema: () => untrimmed as never });
    expect(lines(await open({}).run(behave))).toEqual([
      '(core) TITLE_INPUT — accepts whitespace-only text although the field requires text',
      '(core) TITLE_INPUT — does not trim its text',
      '(core) NOTE_INPUT — does not trim its text',
    ]);
  });
});

describe('the facts', () => {
  it('refuses missing folders, a reviewed count that is not a positive whole number, and missing loaders', () => {
    expect(
      textFieldDeclarationsGuard.factProblems({
        ...facts(),
        wireFolders: [],
        declarationsFile: '',
        selfBounded: [{ file: 'a.js', declaration: 'A', count: 0, why: 'x' }],
        declarations: undefined as never,
      }),
    ).toEqual([
      'wireFolders is empty',
      'declarationsFile is missing',
      "selfBounded entry a.js#A's count must be a positive whole number",
      'declarations needs a loader function',
    ]);
  });

  it('refuses a folder or suffix listed twice', () => {
    expect(textFieldDeclarationsGuard.factProblems({ ...facts(), wireFolders: ['w', 'w'], wireInputNameSuffixes: ['Input', 'Input'] })).toEqual([
      'wireFolders lists w twice',
      'wireInputNameSuffixes lists Input twice',
    ]);
  });
});
