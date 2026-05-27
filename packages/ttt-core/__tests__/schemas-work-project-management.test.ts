import { describe, it, expect } from 'vitest';
import {
  InviteSourceSchema,
  InviteUserToGuildInputSchema,
} from '../src/schemas/work-project-management';
import { MAX_INVITE_MESSAGE_LENGTH } from '../src/constants/business';

const validStandaloneSource = { type: 'standalone' } as const;

const validSkillSource = {
  type: 'craftSkill',
  data: {
    craftSkillId: 'craftSkill-1',
    craftSkillOwnerUserId: 'user-1',
    craftSkillName: 'Guitar',
  },
} as const;

const validJobSource = {
    type: 'commission',
    data: {
      commissionListingId: 'commission-1',
      auditionEntryId: 'reply-1',
      commissionTitle: 'Lead Developer',
      proposalArtisanUserId: 'user-2',
      postingStakeSharesOffered: 10,
    },
} as const;

const validOpportunitySource = {
    type: 'audition',
    data: {
      auditionId: 'opp-1',
      auditionEntryId: 'reply-2',
      auditionTitle: 'Featured Placement',
      respondentUserId: 'user-3',
      postingStakeSharesOffered: 5,
    },
} as const;

describe('InviteSourceSchema', () => {
  it('accepts { type: standalone }', () => {
    expect(InviteSourceSchema.parse(validStandaloneSource)).toEqual(validStandaloneSource);
  });

  it('rejects standalone with a data field', () => {
    expect(() =>
      InviteSourceSchema.parse({ type: 'standalone', data: {} }),
    ).toThrow();
  });

  it('accepts a valid craftSkill source', () => {
    expect(InviteSourceSchema.parse(validSkillSource)).toEqual(validSkillSource);
  });

  it('accepts a valid commission source', () => {
    expect(InviteSourceSchema.parse(validJobSource)).toEqual(validJobSource);
  });

  it('accepts a valid audition source', () => {
    expect(InviteSourceSchema.parse(validOpportunitySource)).toEqual(validOpportunitySource);
  });

  it('rejects unknown type value', () => {
    expect(() =>
      InviteSourceSchema.parse({ type: 'referral' }),
    ).toThrow();
  });

  it('rejects nested unknown keys inside commission data (.strict)', () => {
    expect(() =>
      InviteSourceSchema.parse({
        type: 'commission',
        data: {
          ...validJobSource.data,
          unknownField: 'bad',
        },
      }),
    ).toThrow();
  });

  it('rejects nested unknown keys inside craftSkill data (.strict)', () => {
    expect(() =>
      InviteSourceSchema.parse({
        type: 'craftSkill',
        data: {
          ...validSkillSource.data,
          extraKey: true,
        },
      }),
    ).toThrow();
  });

  it('rejects postingStakeSharesOffered: 0 on commission branch', () => {
    expect(() =>
      InviteSourceSchema.parse({
        type: 'commission',
        data: { ...validJobSource.data, postingStakeSharesOffered: 0 },
      }),
    ).toThrow();
  });

  it('rejects postingStakeSharesOffered: 0 on audition branch', () => {
    expect(() =>
      InviteSourceSchema.parse({
        type: 'audition',
        data: { ...validOpportunitySource.data, postingStakeSharesOffered: 0 },
      }),
    ).toThrow();
  });
});

describe('InviteUserToGuildInputSchema', () => {
  const baseInput = {
    workProjectId: 'workProject-1',
    inviteeUid: 'user-99',
    message: 'Join us!',
    stakeSharesOffered: 10,
  };

  it('accepts a fully valid input with standalone source', () => {
    const input = { ...baseInput, source: validStandaloneSource };
    expect(InviteUserToGuildInputSchema.parse(input)).toEqual(input);
  });

  it('accepts a fully valid input with craftSkill source', () => {
    const input = { ...baseInput, source: validSkillSource };
    expect(InviteUserToGuildInputSchema.parse(input)).toEqual(input);
  });

  it('accepts a fully valid input with commission source', () => {
    const input = { ...baseInput, source: validJobSource };
    expect(InviteUserToGuildInputSchema.parse(input)).toEqual(input);
  });

  it('accepts a fully valid input with audition source', () => {
    const input = { ...baseInput, source: validOpportunitySource };
    expect(InviteUserToGuildInputSchema.parse(input)).toEqual(input);
  });

  it('rejects missing source', () => {
    expect(() =>
      InviteUserToGuildInputSchema.parse(baseInput),
    ).toThrow();
  });

  it('rejects stakeSharesOffered: 0', () => {
    expect(() =>
      InviteUserToGuildInputSchema.parse({
        ...baseInput,
        stakeSharesOffered: 0,
        source: validStandaloneSource,
      }),
    ).toThrow();
  });

  it('rejects empty message', () => {
    expect(() =>
      InviteUserToGuildInputSchema.parse({
        ...baseInput,
        message: '',
        source: validStandaloneSource,
      }),
    ).toThrow();
  });

  it('rejects message longer than MAX_INVITE_MESSAGE_LENGTH', () => {
    expect(() =>
      InviteUserToGuildInputSchema.parse({
        ...baseInput,
        message: 'x'.repeat(MAX_INVITE_MESSAGE_LENGTH + 1),
        source: validStandaloneSource,
      }),
    ).toThrow();
  });

  it('rejects unknown top-level keys (.strict)', () => {
    expect(() =>
      InviteUserToGuildInputSchema.parse({
        ...baseInput,
        source: validStandaloneSource,
        extraField: 'bad',
      }),
    ).toThrow();
  });
});


