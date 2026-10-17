// A definition the core owns is written once: a guarded member only in its owner (and reviewed
// uses), no app module re-declaring a core constant, no app module restating a core union.

import { afterAll, describe, expect, it } from 'vitest';
import {
  codeLiterals,
  definitionRedeclarationGuard,
  type DefinitionRedeclarationFacts,
} from '../../src/modules/core-definitions/redeclaration.js';
import { viewOfText } from '../../src/reader/view.js';
import { CORE, fixture, lines, type Fixture } from './fixture.js';

const CORE_FILES: Record<string, string> = {
  [`${CORE}/kinds.js`]: "export const KIND_VALUES = ['alphaKind', 'betaKind'];\nexport const KindSchema = z.enum(KIND_VALUES);\nexport const LIMIT_MAX = 5;",
  [`${CORE}/kinds.d.ts`]:
    'export declare const KIND_VALUES: readonly ["alphaKind", "betaKind"];\nexport type Kind = \'alphaKind\' | \'betaKind\';\nexport declare const LIMIT_MAX: 5;',
  [`${CORE}/order.js`]: "export const KIND_ORDER = ['alphaKind', 'betaKind'];",
  // A derived schema: its declaration file spells the members only inside the inferred type.
  [`${CORE}/derived.js`]: "// 'alphaKind' named in prose\nexport const DerivedSchema = z.object({ kind: KindSchema });",
  [`${CORE}/derived.d.ts`]: 'export declare const DerivedSchema: z.ZodObject<{ kind: z.ZodEnum<{ alphaKind: "alphaKind" }> }>;',
};

const facts = (overrides: Partial<DefinitionRedeclarationFacts['guardedLiterals'][number]> = {}): DefinitionRedeclarationFacts => ({
  guardedLiterals: [
    {
      literal: 'alphaKind',
      owners: [`${CORE}/kinds.js`],
      allowed: [{ file: `${CORE}/order.js`, declaration: 'KIND_ORDER', why: 'a typed ordering array the compiler checks' }],
      ...overrides,
    },
  ],
});

const [members, constants, unions] = definitionRedeclarationGuard.build(facts());

const opened: Fixture[] = [];
const open = (files: Record<string, string>) => {
  const f = fixture({ ...CORE_FILES, ...files });
  opened.push(f);
  return f;
};
afterAll(() => opened.forEach((f) => f.repo.remove()));

describe('guarded core definition members', () => {
  it('passes the owner, a reviewed use, a derived schema, and prose', async () => {
    expect(lines(await open({}).run(members))).toEqual([]);
  });

  it('FLAGS a member quoted in another compiled module, a hand-written type restating it, and an unreviewed declaration beside a reviewed one', async () => {
    const f = open({
      [`${CORE}/rogue.js`]: "export const ROGUE = 'alphaKind';",
      [`${CORE}/rogue-type.d.ts`]: "export type RogueKind = 'alphaKind' | 'other';",
      [`${CORE}/order.js`]: "export const KIND_ORDER = ['alphaKind', 'betaKind'];\nexport function pick() {\n  return 'alphaKind';\n}",
    });
    expect(lines(await f.run(members))).toEqual([
      `${CORE}/order.js:3 — 'alphaKind' re-declared in pick — import it from its owner (${CORE}/kinds.js)`,
      `${CORE}/rogue-type.d.ts:1 — 'alphaKind' re-declared in RogueKind — import it from its owner (${CORE}/kinds.js)`,
      `${CORE}/rogue.js:1 — 'alphaKind' re-declared in ROGUE — import it from its owner (${CORE}/kinds.js)`,
    ]);
  });

  it('FLAGS an allowance whose use is gone, an owner that no longer declares the member, and an owner that no longer exists', async () => {
    const [guard] = definitionRedeclarationGuard.build(
      facts({
        owners: [`${CORE}/kinds.js`, `${CORE}/derived.js`, `${CORE}/moved.js`],
        allowed: [{ file: `${CORE}/order.js`, declaration: 'GONE_ORDER', why: 'reviewed once' }],
      }),
    );
    const f = open({ [`${CORE}/order.js`]: 'export const KIND_ORDER = [];' });
    expect(lines(await f.run(guard))).toEqual([
      `${CORE}/derived.js — stale owner of 'alphaKind': the module no longer declares it`,
      `${CORE}/moved.js — stale owner of 'alphaKind': the module no longer exists`,
      `${CORE}/order.js — stale allowance for 'alphaKind' in GONE_ORDER: the use it excuses is gone`,
    ]);
  });

  it('counts an owner whose member lives only in its type declarations', async () => {
    const [guard] = definitionRedeclarationGuard.build({
      guardedLiterals: [{ literal: 'betaKind', owners: [`${CORE}/types-only.js`], allowed: [] }],
    });
    const f = open({
      [`${CORE}/types-only.js`]: 'export {};',
      [`${CORE}/types-only.d.ts`]: "export type Beta = 'betaKind' | 'gammaKind';",
      [`${CORE}/kinds.js`]: 'export const LIMIT_MAX = 5;',
      [`${CORE}/kinds.d.ts`]: 'export declare const LIMIT_MAX: 5;',
      [`${CORE}/order.js`]: 'export {};',
    });
    expect(lines(await f.run(guard))).toEqual([]);
  });
});

describe('what counts as a member written in code', () => {
  const declarationsOf = (path: string, text: string) =>
    codeLiterals(viewOfText(path, text))
      .filter((hit) => hit.value === 'chapter')
      .map((hit) => hit.declaration);

  it('counts a quoted key, a type-position union, a z.enum member, and a plain template, each under its top-level declaration', () => {
    const text = [
      "export const QUOTED = { 'chapter': 1 };",
      "export type SubItem = 'chapter' | 'track';",
      "export const SubItemSchema = z.enum(['chapter', 'track']);",
      'export const TEMPLATE = `chapter`;',
      'export function resolve(kind: string) {',
      "  return kind === 'chapter' ? kind : 'track';",
      '}',
    ].join('\n');
    expect(declarationsOf('kinds.ts', text)).toEqual(['QUOTED', 'SubItem', 'SubItemSchema', 'TEMPLATE', 'resolve']);
  });

  it('ignores an identifier key, an interpolated template, prose, and a // inside a string hides nothing', () => {
    const text = [
      'export const PLAIN = { chapter: 1 };',
      'export const BUILT = `chapter/${id}`;',
      "// the 'chapter' surface, in prose",
      "/** a Tale's 'chapter' sub-item */",
      "export const PAIR = ['https://example.test//guide', 'chapter'];",
    ].join('\n');
    expect(declarationsOf('kinds.ts', text)).toEqual(['PAIR']);
  });
});

describe('app modules and core constants', () => {
  it('passes an import of the constant, a constant of another name, a function-scoped name, and test code', async () => {
    const f = open({
      'src/lib/uses.ts': "import { KIND_VALUES } from '@fx/core';\nconst KIND_VALUES_SHOWN = KIND_VALUES.length;\nfunction g() {\n  const LIMIT_MAX = 1;\n  return LIMIT_MAX;\n}",
      'src/lib/uses.test.ts': 'const LIMIT_MAX = 5;',
      'src/test/limits.ts': 'export const LIMIT_MAX = 5;',
    });
    expect(lines(await f.run(constants))).toEqual([]);
  });

  it('FLAGS a module-scope constant declared under a name the core exports, in either app root', async () => {
    const f = open({
      'functions/src/paths.ts': "export const KIND_VALUES = ['alphaKind'];",
      'src/lib/limit.ts': '\nlet LIMIT_MAX = 5;',
    });
    expect(lines(await f.run(constants))).toEqual([
      "functions/src/paths.ts:1 — KIND_VALUES is declared here under the core's own name — import it from the core and delete this copy",
      "src/lib/limit.ts:2 — LIMIT_MAX is declared here under the core's own name — import it from the core and delete this copy",
    ]);
  });

  it('FLAGS a core that declares no exported constant, since the check would compare nothing', async () => {
    const f = open({ [`${CORE}/kinds.d.ts`]: 'export type Kind = string;', [`${CORE}/derived.d.ts`]: 'export {};' });
    expect(lines(await f.run(constants))).toEqual(['(core build) — the installed core declares no exported constant, so the check compares nothing']);
  });
});

describe('app modules and core unions', () => {
  it('FLAGS a union type, a parameter union, a z.enum, and a bound array literal restating a core union', async () => {
    const f = open({
      'functions/src/probe.ts': [
        "type Leader = 'alphaKind' | 'betaKind';",
        'function lead(role: "alphaKind" | "betaKind" | undefined) {}',
        "const schema = z.enum(['alphaKind', 'betaKind']);",
        "const LEADERS = ['betaKind', 'alphaKind'] as const;",
      ].join('\n'),
    });
    expect(lines(await f.run(unions))).toEqual([
      "functions/src/probe.ts:1 — 'alphaKind' | 'betaKind' restates KIND_VALUES — derive from the core's declaration",
      "functions/src/probe.ts:2 — 'alphaKind' | 'betaKind' restates KIND_VALUES — derive from the core's declaration",
      "functions/src/probe.ts:3 — 'alphaKind' | 'betaKind' restates KIND_VALUES — derive from the core's declaration",
      "functions/src/probe.ts:4 — 'betaKind' | 'alphaKind' restates KIND_VALUES — derive from the core's declaration",
    ]);
  });

  it('passes a derived type, one member, unrelated literals, the declared array, prose, and test code', async () => {
    const f = open({
      'src/lib/probe.ts': [
        "import { KIND_VALUES, type Kind } from '@fx/core';",
        'type Leader = Kind;',
        "const isAlpha = (k: Kind) => k === 'alphaKind';",
        "type Probe = 'alpha-probe' | 'beta-probe';",
        "type Mixed = 'alphaKind' | 'notAKind';",
        'const schema = z.enum(KIND_VALUES);',
        "// 'alphaKind' | 'betaKind' is the union, named in prose",
        "const label = \"'alphaKind' | 'betaKind'\";",
      ].join('\n'),
      'src/lib/probe.test.ts': "type Leader = 'alphaKind' | 'betaKind';",
    });
    expect(lines(await f.run(unions))).toEqual([]);
  });
});

describe('the facts', () => {
  it('refuses a missing member list, a member listed twice, a member with no owner, and an allowance with no why', () => {
    expect(definitionRedeclarationGuard.factProblems({ guardedLiterals: [] })).toEqual([
      'guardedLiterals is missing or empty — name the most distinctive member of each canonical union',
    ]);
    expect(
      definitionRedeclarationGuard.factProblems({
        guardedLiterals: [
          { literal: 'alphaKind', owners: [], allowed: [{ file: 'x.js', declaration: 'X', why: ' ' }] },
          { literal: 'alphaKind', owners: ['kinds.js'], allowed: [] },
        ],
      }),
    ).toEqual([
      "the owners of 'alphaKind' is empty",
      "the allowed uses of 'alphaKind' entry x.js#X carries no why",
      "guarded literal 'alphaKind' is listed twice",
    ]);
  });
});
