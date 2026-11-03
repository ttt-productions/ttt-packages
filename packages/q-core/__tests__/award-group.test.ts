import { describe, expect, it } from 'vitest';
import {
  AwardGroupChangeResultSchema,
  AwardGroupTargetInputSchema,
} from '../src/schemas/awards.js';

describe('an award group change', () => {
  it('names one award and one team or league', () => {
    for (const groupType of ['team', 'league']) {
      expect(
        AwardGroupTargetInputSchema.safeParse({
          awardId: 'a1',
          group: { groupType, groupId: 'g1' },
        }).success,
        groupType,
      ).toBe(true);
    }
    expect(
      AwardGroupTargetInputSchema.safeParse({
        awardId: 'a1',
        group: { groupType: 'user', groupId: 'g1' },
      }).success,
    ).toBe(false);
    expect(AwardGroupTargetInputSchema.safeParse({ awardId: 'a1' }).success).toBe(false);
  });

  it('takes no grant or remove switch: each action is its own callable', () => {
    expect(
      AwardGroupTargetInputSchema.safeParse({
        awardId: 'a1',
        action: 'grant',
        group: { groupType: 'team', groupId: 't1' },
      }).success,
    ).toBe(false);
  });

  it('answers how many people changed, nobody included', () => {
    expect(AwardGroupChangeResultSchema.safeParse({ awardId: 'a1', changedCount: 0 }).success).toBe(
      true,
    );
    expect(
      AwardGroupChangeResultSchema.safeParse({ awardId: 'a1', changedCount: -1 }).success,
    ).toBe(false);
    expect(
      AwardGroupChangeResultSchema.safeParse({ awardId: 'a1', changedCount: 3, opened: true })
        .success,
    ).toBe(false);
  });
});
