import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  CRAFT_SKILL_MIMIC_OFF_TTT_UNAVAILABLE_MESSAGE,
  CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES,
  BLOCKED_CRAFT_SKILL_KINDS,
  CRAFT_SKILL_KIND_ORDER,
  isBlockedCraftSkillKind,
  type BlockedCraftSkillKind,
} from '../src/constants/craft-skill-statements';
import { CraftSkillKindSchema, type CraftSkillKind } from '../src/doc-schemas/user';
import * as root from '../src/index';

describe('off-TTT craft refusal copy', () => {
  it('is the settled sentence, verbatim', () => {
    expect(CRAFT_SKILL_MIMIC_OFF_TTT_UNAVAILABLE_MESSAGE).toBe(
      "This option isn't available yet: sharing covers or recreations of work from outside TTT needs legal review first.",
    );
  });

  it('ships on the server-safe root, so the picker and the upload callable share one sentence', () => {
    expect(root.CRAFT_SKILL_MIMIC_OFF_TTT_UNAVAILABLE_MESSAGE).toBe(CRAFT_SKILL_MIMIC_OFF_TTT_UNAVAILABLE_MESSAGE);
  });
});

describe('craft kinds blocked at launch — one owner', () => {
  it('blocks exactly the off-TTT kind, with its refusal copy', () => {
    expect(BLOCKED_CRAFT_SKILL_KINDS).toEqual(['mimicOffTtt']);
    expect(CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES.mimicOffTtt).toBe(CRAFT_SKILL_MIMIC_OFF_TTT_UNAVAILABLE_MESSAGE);
  });

  it('derives the blocked set from the refusal copy, so every blocked kind has non-empty copy', () => {
    expect([...BLOCKED_CRAFT_SKILL_KINDS].sort()).toEqual(Object.keys(CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES).sort());
    for (const kind of BLOCKED_CRAFT_SKILL_KINDS) {
      expect(CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES[kind].length, kind).toBeGreaterThan(0);
    }
  });

  it('keeps every blocked kind a real, still-listed kind (it renders in the picker)', () => {
    for (const kind of BLOCKED_CRAFT_SKILL_KINDS) {
      expect(CraftSkillKindSchema.safeParse(kind).success, kind).toBe(true);
      expect(CRAFT_SKILL_KIND_ORDER, kind).toContain(kind);
    }
  });

  it('isBlockedCraftSkillKind answers for every kind and narrows to index the copy', () => {
    for (const kind of CraftSkillKindSchema.options) {
      expect(isBlockedCraftSkillKind(kind), kind).toBe(BLOCKED_CRAFT_SKILL_KINDS.includes(kind as BlockedCraftSkillKind));
    }
    expect(isBlockedCraftSkillKind('original')).toBe(false);
    expect(isBlockedCraftSkillKind('mimicOnTtt')).toBe(false);
    const kind: CraftSkillKind = 'mimicOffTtt';
    if (isBlockedCraftSkillKind(kind)) {
      expectTypeOf(kind).toEqualTypeOf<BlockedCraftSkillKind>();
      expect(CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES[kind]).toBe(CRAFT_SKILL_MIMIC_OFF_TTT_UNAVAILABLE_MESSAGE);
    } else {
      throw new Error('mimicOffTtt must be blocked');
    }
  });

  it('does not treat inherited object keys as blocked kinds', () => {
    const untyped = isBlockedCraftSkillKind as (kind: string) => boolean;
    expect(untyped('toString')).toBe(false);
    expect(untyped('constructor')).toBe(false);
  });

  it('ships on the server-safe root for the upload callable and the picker', () => {
    expect(root.BLOCKED_CRAFT_SKILL_KINDS).toBe(BLOCKED_CRAFT_SKILL_KINDS);
    expect(root.CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES).toBe(CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES);
    expect(root.isBlockedCraftSkillKind).toBe(isBlockedCraftSkillKind);
  });
});
