import { describe, it, expect } from 'vitest';
import {
  FuturePlansContentInputSchema,
  RulesAndAgreementsContentInputSchema,
} from '../src/schemas/admin';
import { FuturePlansContentSchema, RulesAndAgreementsContentSchema } from '../src/doc-schemas/public-documents';
import { RULE_GROUP_KEYS } from '../src/types/content';
import {
  SYSTEM_SLOTS,
  getSystemSlot,
  isRequiredVideoSlot,
  ruleGroupVideoSlotId,
  systemSlotsByGroup,
} from '../src/system-slots/system-slots';

const group = { id: 'world-engine', name: 'The World Engine', order: 0 };
const plan = { id: 'p1', title: 'Build whole worlds', description: 'Words.', groupId: 'world-engine', order: 0 };
const rule = { id: 'r1', title: 'Stay on topic', description: 'Words.', group: 'generic', order: 1 };
const point = { id: 'a1', text: 'Your published Work becomes TTT-owned.' };

describe('Future Plans content', () => {
  it('holds an intro, groups with intention lines, and plans that each belong to a group', () => {
    const content = {
      intro: 'First paragraph.\n\nSecond paragraph.',
      groups: [{ ...group, intention: 'Worlds first.' }],
      plans: [plan],
    };
    expect(FuturePlansContentInputSchema.safeParse(content).success).toBe(true);
    expect(FuturePlansContentSchema.safeParse(content).success).toBe(true);
  });

  it('refuses a plan whose group the document does not hold', () => {
    const result = FuturePlansContentInputSchema.safeParse({ groups: [group], plans: [{ ...plan, groupId: 'gone' }] });
    expect(result.success).toBe(false);
  });

  it('refuses two groups sharing one id', () => {
    expect(FuturePlansContentInputSchema.safeParse({ groups: [group, { ...group, order: 1 }], plans: [] }).success).toBe(false);
  });

  it('refuses a video URL on a plan — a section video is a system slot', () => {
    const withVideo = { groups: [group], plans: [{ ...plan, videoUrl: 'https://example.com/v.mp4' }] };
    expect(FuturePlansContentInputSchema.safeParse(withVideo).success).toBe(false);
  });

  it('refuses a blank intro — no intro is an absent field', () => {
    expect(FuturePlansContentInputSchema.safeParse({ intro: '   ', groups: [], plans: [] }).success).toBe(false);
  });
});

describe('Rules & Agreements content', () => {
  const base = { rules: [rule], agreements: { points: [point] } };

  it('holds an intro, group intention lines, typed rules, and one Artisan Agreement list', () => {
    const content = {
      intro: 'Our Intention.',
      groupIntentions: { merchandising: 'Every dollar is split the same honest way.' },
      rules: [{ ...rule, group: 'hallWing', hallWingType: 'educational' }],
      agreements: { intention: 'What you agree to.', points: [{ ...point, workProjectType: 'Tales' }] },
    };
    expect(RulesAndAgreementsContentInputSchema.safeParse(content).success).toBe(true);
    expect(RulesAndAgreementsContentSchema.safeParse(content).success).toBe(true);
  });

  it('refuses a Work type or Hall wing the canonical lists do not hold', () => {
    expect(RulesAndAgreementsContentInputSchema.safeParse({ ...base, rules: [{ ...rule, workProjectType: 'Comics' }] }).success).toBe(false);
    expect(
      RulesAndAgreementsContentInputSchema.safeParse({ ...base, agreements: { points: [{ ...point, hallWingType: 'sports' }] } }).success,
    ).toBe(false);
  });

  it('refuses the retired per-medium agreement lists and rule subgroups', () => {
    expect(RulesAndAgreementsContentInputSchema.safeParse({ rules: [], agreements: { tales: { points: [] } } }).success).toBe(false);
    expect(RulesAndAgreementsContentInputSchema.safeParse({ ...base, rules: [{ ...rule, subgroup: 'Tales' }] }).success).toBe(false);
    expect(RulesAndAgreementsContentInputSchema.safeParse({ ...base, rules: [{ ...rule, group: 'workProjectType' }] }).success).toBe(false);
  });

  it('refuses a video URL on a rule or the agreements', () => {
    expect(
      RulesAndAgreementsContentInputSchema.safeParse({ ...base, rules: [{ ...rule, videoUrl: 'https://example.com/v.mp4' }] }).success,
    ).toBe(false);
    expect(
      RulesAndAgreementsContentInputSchema.safeParse({ rules: [], agreements: { points: [], videoUrl: 'https://example.com/v.mp4' } })
        .success,
    ).toBe(false);
  });

  it('refuses a rule with no group — it would sit on no section of the page', () => {
    const { group: _group, ...ungrouped } = rule;
    expect(RulesAndAgreementsContentInputSchema.safeParse({ ...base, rules: [ungrouped] }).success).toBe(false);
  });
});

describe('public document section videos', () => {
  it('registers one optional slot for the Future Plans page and the Rules page', () => {
    for (const id of ['future-plans-page', 'rules-page', 'rules-artisan-agreements'] as const) {
      expect(getSystemSlot(id)?.kind).toBe('video');
      expect(isRequiredVideoSlot(id)).toBe(false);
    }
  });

  it('registers one optional slot under every fixed rule group', () => {
    for (const ruleGroup of RULE_GROUP_KEYS) {
      const id = ruleGroupVideoSlotId(ruleGroup);
      expect(getSystemSlot(id)).toMatchObject({ kind: 'video', group: 'rulesPage' });
      expect(isRequiredVideoSlot(id)).toBe(false);
    }
  });

  it('groups them under their page in the admin view', () => {
    const groups = systemSlotsByGroup();
    const rulesPage = groups.find((entry) => entry.group.id === 'rulesPage');
    const futurePlansPage = groups.find((entry) => entry.group.id === 'futurePlansPage');
    expect(futurePlansPage?.slots.map((slot) => slot.id)).toEqual(['future-plans-page']);
    expect(rulesPage?.slots).toHaveLength(RULE_GROUP_KEYS.length + 2);
    expect(SYSTEM_SLOTS.filter((slot) => slot.group === 'rulesPage' && slot.kind !== 'video')).toEqual([]);
  });
});
