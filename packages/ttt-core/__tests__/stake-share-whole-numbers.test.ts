import { describe, it, expect } from 'vitest';
import { FullCommissionListingSchema, AuditionSchema } from '../src/doc-schemas/commissions';
import { GuildInviteConversationSchema } from '../src/doc-schemas/messaging';
import { MAX_WORK_PROJECT_STAKE_SHARES } from '../src/constants/business';

const offered = (schema: { shape: Record<string, { safeParse: (v: unknown) => { success: boolean } }> }) =>
  schema.shape.stakeSharesOffered;

describe('stored stake-share offers are whole, positive numbers', () => {
  it('a commission listing offers a whole number of stake shares, within the Work total', () => {
    const field = offered(FullCommissionListingSchema);
    expect(field.safeParse(25).success).toBe(true);
    expect(field.safeParse(MAX_WORK_PROJECT_STAKE_SHARES).success).toBe(true);
    for (const bad of [2.5, 0, -1, MAX_WORK_PROJECT_STAKE_SHARES + 1]) {
      expect(field.safeParse(bad).success, String(bad)).toBe(false);
    }
  });

  it('an audition offers a whole number of stake shares, within the Work total, or none', () => {
    const field = offered(AuditionSchema);
    expect(field.safeParse(undefined).success).toBe(true);
    expect(field.safeParse(5).success).toBe(true);
    for (const bad of [0.5, 0, -3, MAX_WORK_PROJECT_STAKE_SHARES + 1]) {
      expect(field.safeParse(bad).success, String(bad)).toBe(false);
    }
  });

  it('a guild invite offers a whole, positive number of stake shares', () => {
    const field = offered(GuildInviteConversationSchema);
    expect(field.safeParse(10).success).toBe(true);
    for (const bad of [1.5, 0, -1]) {
      expect(field.safeParse(bad).success, String(bad)).toBe(false);
    }
  });
});

describe('one stake-share offer constraint', () => {
  it('every offer site uses the one atom', async () => {
    const { stakeSharesOfferedSchema } = await import('../src/schemas/atoms');
    const { CommissionPostingTargetInfoSchema } = await import('../src/media/target-info');
    expect(FullCommissionListingSchema.shape.stakeSharesOffered).toBe(stakeSharesOfferedSchema);
    expect(CommissionPostingTargetInfoSchema.shape.stakeSharesOffered).toBe(stakeSharesOfferedSchema);
    for (const bad of [0, 1.5, MAX_WORK_PROJECT_STAKE_SHARES + 1]) {
      expect(stakeSharesOfferedSchema.safeParse(bad).success).toBe(false);
    }
  });
});
