import { describe, it, expect } from 'vitest';
import { CreateWorkProjectAuditionVariablesSchema } from '../src/upload-variables/create-work-project-audition-variables';
import { CreateAdminAuditionVariablesSchema } from '../src/upload-variables/create-admin-audition-variables';
import { CreateCommissionVariablesSchema } from '../src/upload-variables/create-commission-variables';
import { MAX_SPONSORED_AUDITION_AMOUNT_USD } from '../src/constants/business';

const DAY = 24 * 60 * 60 * 1000;
const file = new Blob(['x']);
const deadlines = { entriesCloseAt: 1_700_000_000_000, auditionCloseAt: 1_700_000_000_000 + DAY };
const onProgress = () => {};

describe('audition upload variables carry the same deadline contract as the target info', () => {
  const work = { title: 'T', description: 'D', videoFile: file, workProjectId: 'p1', onProgress, ...deadlines };

  it('accepts both deadlines as epoch ms', () => {
    expect(CreateWorkProjectAuditionVariablesSchema.safeParse(work).success).toBe(true);
  });

  it('refuses an audition that closes less than 24 hours after entries close', () => {
    const tooSoon = { ...work, auditionCloseAt: deadlines.entriesCloseAt + DAY - 1 };
    expect(CreateWorkProjectAuditionVariablesSchema.safeParse(tooSoon).success).toBe(false);
  });

  it('refuses a stake offer of zero, like its target info', () => {
    expect(CreateWorkProjectAuditionVariablesSchema.safeParse({ ...work, stakeSharesOffered: 0 }).success).toBe(false);
    expect(CreateWorkProjectAuditionVariablesSchema.safeParse({ ...work, stakeSharesOffered: 1 }).success).toBe(true);
  });
});

describe('admin audition upload variables are discriminated by type', () => {
  const admin = { title: 'T', description: 'D', videoFile: file, onProgress, ...deadlines };

  it('requires a sponsored audition to carry a positive prize up to the maximum', () => {
    const sponsored = { ...admin, type: 'sponsoredAudition' as const };
    const parse = (amount?: number) =>
      CreateAdminAuditionVariablesSchema.safeParse(
        amount === undefined ? sponsored : { ...sponsored, sponsoredAuditionAmountUSD: amount },
      ).success;
    expect(parse()).toBe(false);
    expect(parse(0)).toBe(false);
    expect(parse(MAX_SPONSORED_AUDITION_AMOUNT_USD + 1)).toBe(false);
    expect(parse(MAX_SPONSORED_AUDITION_AMOUNT_USD)).toBe(true);
  });

  it('refuses a prize amount on a platform audition', () => {
    const platform = { ...admin, type: 'platformAudition' as const };
    expect(CreateAdminAuditionVariablesSchema.safeParse(platform).success).toBe(true);
    expect(CreateAdminAuditionVariablesSchema.safeParse({ ...platform, sponsoredAuditionAmountUSD: 10 }).success).toBe(false);
  });
});

describe('commission upload variables', () => {
  it('refuses a stake offer of zero, like its target info', () => {
    const listing = { title: 'T', description: 'D', requiredTradeProfessions: [], stakeSharesOffered: 0 };
    const base = { workProjectId: 'p1', file, onProgress, commissionListingData: listing };
    expect(CreateCommissionVariablesSchema.safeParse(base).success).toBe(false);
    const one = { ...base, commissionListingData: { ...listing, stakeSharesOffered: 1 } };
    expect(CreateCommissionVariablesSchema.safeParse(one).success).toBe(true);
  });
});
