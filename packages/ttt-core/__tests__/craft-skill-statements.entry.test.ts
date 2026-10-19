import { describe, it, expect } from 'vitest';
import {
  CRAFT_SKILL_MIMIC_OFF_TTT_UNAVAILABLE_MESSAGE,
  CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES,
  BLOCKED_CRAFT_SKILL_KINDS,
  isBlockedCraftSkillKind,
} from '../src/constants/craft-skill-statements.js';
import * as constants from '../src/constants/index.js';

describe('off-TTT craft refusal copy', () => {
  it('ships on the server-safe constants entry, so the picker and the upload callable share one sentence', () => {
    expect(constants.CRAFT_SKILL_MIMIC_OFF_TTT_UNAVAILABLE_MESSAGE).toBe(CRAFT_SKILL_MIMIC_OFF_TTT_UNAVAILABLE_MESSAGE);
  });
});

describe('craft kinds blocked at launch — one owner', () => {
  it('ships on the server-safe constants entry for the upload callable and the picker', () => {
    expect(constants.BLOCKED_CRAFT_SKILL_KINDS).toBe(BLOCKED_CRAFT_SKILL_KINDS);
    expect(constants.CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES).toBe(CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES);
    expect(constants.isBlockedCraftSkillKind).toBe(isBlockedCraftSkillKind);
  });
});
