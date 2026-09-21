// Fixture coverage for the scanner the definition-redeclaration guard runs on.
//
// The guard is only as honest as its notion of "this literal is written in code". These
// fixtures pin that notion: prose never counts, a `//` inside a string never truncates the
// scan, and a constructed (interpolated) string is not a member declaration. The last test
// pins the reason the allowlist is declaration-scoped: a real re-declaration inside a file
// that carries one reviewed exception is now caught instead of being waved through.

import { describe, it, expect } from 'vitest';
import {
  collectCodeStringLiterals,
  isExcusedOccurrence,
  type GuardedLiteral,
} from './support/code-string-literals';

const FIXTURE = 'fixture.ts';

function valuesOf(source: string, literal: string): string[] {
  return collectCodeStringLiterals(FIXTURE, source)
    .filter((hit) => hit.value === literal)
    .map((hit) => hit.declaration);
}

describe('code-string-literal scanner', () => {
  it('ignores a member name in a line comment', () => {
    expect(valuesOf(`// the sub-item surface is chapter, not 'chapter' as written here\n`, 'chapter')).toEqual([]);
  });

  it('ignores a member name in a block comment', () => {
    expect(valuesOf(`/* a Tale's sub-item is a 'chapter' */\nexport const X = 1;\n`, 'chapter')).toEqual([]);
  });

  it('ignores a member name in a JSDoc comment', () => {
    const source = [
      '/**',
      " * Routes a Tale to its 'chapter' sub-item surface — an accurate doc comment must be",
      ' * allowed to name the member it documents.',
      ' */',
      'export const ROUTE = 1;',
      '',
    ].join('\n');
    expect(valuesOf(source, 'chapter')).toEqual([]);
  });

  it('does not let a `//` inside a string hide the rest of the line', () => {
    const source = `export const PAIR = ['https://example.test//guide', 'chapter'];\n`;
    expect(valuesOf(source, 'chapter')).toEqual(['PAIR']);
  });

  it('counts a no-substitution template literal but not an interpolated one', () => {
    const backtickChapter = ['export const TEMPLATE = ', '`chapter`', ';'].join('');
    const interpolated = ['export const BUILT = ', '`chapter/${id}`', ';'].join('');
    expect(valuesOf(`${backtickChapter}\n`, 'chapter')).toEqual(['TEMPLATE']);
    expect(valuesOf(`${interpolated}\n`, 'chapter')).toEqual([]);
  });

  it('counts a QUOTED object key but not an identifier key', () => {
    expect(valuesOf(`export const QUOTED = { 'chapter': 1 };\n`, 'chapter')).toEqual(['QUOTED']);
    expect(valuesOf(`export const PLAIN = { chapter: 1 };\n`, 'chapter')).toEqual([]);
  });

  it('counts a literal in a type-position union', () => {
    expect(valuesOf(`export type SubItem = 'chapter' | 'track';\n`, 'chapter')).toEqual(['SubItem']);
  });

  it('counts a z.enum member literal', () => {
    const source = `export const SubItemSchema = z.enum(['chapter', 'track', 'episode']);\n`;
    expect(valuesOf(source, 'chapter')).toEqual(['SubItemSchema']);
  });

  it('reports the nearest enclosing top-level declaration, including inside a function', () => {
    const source = [
      'export function resolveSurface(kind: string): string {',
      "  return kind === 'chapter' ? kind : 'track';",
      '}',
      '',
    ].join('\n');
    expect(valuesOf(source, 'chapter')).toEqual(['resolveSurface']);
  });
});

describe('declaration-scoped allowlisting', () => {
  // The real craft-skill rule: one reviewed derived usage in a non-owner file.
  const RULE: GuardedLiteral = {
    owners: ['ttt-core/src/doc-schemas/user.ts'],
    allowed: [
      {
        file: 'ttt-core/src/constants/craft-skill-statements.ts',
        declaration: 'CRAFT_SKILL_KIND_ORDER',
        why: 'Typed `CraftSkillKind[]` ordering array — the compiler checks every member.',
      },
    ],
  };

  it('catches a real re-declaration inside the file that carries the reviewed exception', () => {
    const file = 'ttt-core/src/constants/craft-skill-statements.ts';
    const source = [
      "export const CRAFT_SKILL_KIND_ORDER: CraftSkillKind[] = ['original', 'mimicOnTtt', 'mimicOffTtt'];",
      "export const CraftSkillKindMirrorSchema = z.enum(['original', 'mimicOnTtt', 'mimicOffTtt']);",
      '',
    ].join('\n');

    const offenders = collectCodeStringLiterals(file, source)
      .filter((hit) => hit.value === 'mimicOnTtt')
      .filter((hit) => !isExcusedOccurrence({ file, declaration: hit.declaration }, RULE))
      .map((hit) => `${file}#${hit.declaration}`);

    expect(offenders).toEqual([`${file}#CraftSkillKindMirrorSchema`]);
  });

  it('still excuses the reviewed derived usage itself', () => {
    const file = 'ttt-core/src/constants/craft-skill-statements.ts';
    expect(isExcusedOccurrence({ file, declaration: 'CRAFT_SKILL_KIND_ORDER' }, RULE)).toBe(true);
  });

  it('excuses every declaration in an owner file', () => {
    const file = 'ttt-core/src/doc-schemas/user.ts';
    expect(isExcusedOccurrence({ file, declaration: 'CraftSkillSchema' }, RULE)).toBe(true);
  });
});
