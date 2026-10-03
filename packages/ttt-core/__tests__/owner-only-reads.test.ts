import { describe, it, expect } from 'vitest';
import {
  GetOwnAuditionEntryStatusInputSchema,
  GetOwnAuditionEntryStatusResultSchema,
  GetOwnHiddenCraftSkillCountInputSchema,
  GetOwnHiddenCraftSkillCountResultSchema,
} from '../src/schemas';

describe("the entrant's own-entry answer", () => {
  it('asks about one audition and nothing else — the caller is the owner', () => {
    expect(GetOwnAuditionEntryStatusInputSchema.safeParse({ auditionId: 'a1' }).success).toBe(true);
    expect(GetOwnAuditionEntryStatusInputSchema.safeParse({ auditionId: 'a1', userId: 'someone' }).success).toBe(false);
  });

  it('answers only whether an entry exists and whether it is under review', () => {
    for (const entryStatus of ['none', 'visible', 'underReview']) {
      expect(GetOwnAuditionEntryStatusResultSchema.safeParse({ auditionId: 'a1', entryStatus }).success).toBe(true);
    }
    expect(GetOwnAuditionEntryStatusResultSchema.safeParse({ auditionId: 'a1', entryStatus: 'hidden' }).success).toBe(false);
  });

  it('never carries the hidden entry itself', () => {
    const parsed = GetOwnAuditionEntryStatusResultSchema.parse({
      auditionId: 'a1',
      entryStatus: 'underReview',
      entry: { videoAssetId: 'v1' },
    });
    expect(parsed).toEqual({ auditionId: 'a1', entryStatus: 'underReview' });
  });
});

describe("the owner's hidden-craft count", () => {
  it('takes no input — the caller is the owner', () => {
    expect(GetOwnHiddenCraftSkillCountInputSchema.safeParse({}).success).toBe(true);
    expect(GetOwnHiddenCraftSkillCountInputSchema.safeParse({ userId: 'someone' }).success).toBe(false);
  });

  it('answers a whole, non-negative count and nothing about the crafts themselves', () => {
    expect(GetOwnHiddenCraftSkillCountResultSchema.safeParse({ hiddenCount: 0 }).success).toBe(true);
    expect(GetOwnHiddenCraftSkillCountResultSchema.safeParse({ hiddenCount: 2 }).success).toBe(true);
    expect(GetOwnHiddenCraftSkillCountResultSchema.safeParse({ hiddenCount: -1 }).success).toBe(false);
    expect(GetOwnHiddenCraftSkillCountResultSchema.safeParse({ hiddenCount: 1.5 }).success).toBe(false);
    expect(
      GetOwnHiddenCraftSkillCountResultSchema.parse({ hiddenCount: 1, craftSkillIds: ['c1'] }),
    ).toEqual({ hiddenCount: 1 });
  });
});
