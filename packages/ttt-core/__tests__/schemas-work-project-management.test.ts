import { describe, it, expect } from 'vitest';
import {
  InviteSourceSchema,
  InviteUserToGuildInputSchema,
  ListGuildInvitesInputSchema,
  CheckRealmNameAvailableInputSchema,
  CreateWorkProjectInputSchema,
  realmWorkingTitleSchema,
} from '../src/schemas/work-project-management';
import { MAX_GUILD_INVITE_MESSAGE_LENGTH } from '../src/constants/business';

const validStandaloneSource = { type: 'standalone' } as const;

const validSkillSource = {
  type: 'craftSkill',
  data: {
    craftSkillId: 'craftSkill-1',
    craftSkillOwnerUserId: 'user-1',
    craftSkillName: 'Guitar',
  },
} as const;

const validCommissionSource = {
    type: 'commission',
    data: {
      commissionListingId: 'commission-1',
      commissionProposalId: 'proposal-1',
      proposalArtisanUserId: 'user-2',
      postingStakeSharesOffered: 10,
    },
} as const;

const validAuditionSource = {
    type: 'audition',
    data: {
      auditionId: 'opp-1',
      auditionEntryId: 'reply-2',
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
    expect(InviteSourceSchema.parse(validCommissionSource)).toEqual(validCommissionSource);
  });

  it('accepts a valid audition source', () => {
    expect(InviteSourceSchema.parse(validAuditionSource)).toEqual(validAuditionSource);
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
          ...validCommissionSource.data,
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
        data: { ...validCommissionSource.data, postingStakeSharesOffered: 0 },
      }),
    ).toThrow();
  });

  it('rejects postingStakeSharesOffered: 0 on audition branch', () => {
    expect(() =>
      InviteSourceSchema.parse({
        type: 'audition',
        data: { ...validAuditionSource.data, postingStakeSharesOffered: 0 },
      }),
    ).toThrow();
  });

  it('rejects a snapshotted commissionTitle (dropped — resolve at render)', () => {
    expect(() =>
      InviteSourceSchema.parse({
        type: 'commission',
        data: { ...validCommissionSource.data, commissionTitle: 'Lead Developer' },
      }),
    ).toThrow();
  });

  it('rejects a snapshotted auditionTitle (dropped — resolve at render)', () => {
    expect(() =>
      InviteSourceSchema.parse({
        type: 'audition',
        data: { ...validAuditionSource.data, auditionTitle: 'Featured Placement' },
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
    const input = { ...baseInput, source: validCommissionSource };
    expect(InviteUserToGuildInputSchema.parse(input)).toEqual(input);
  });

  it('accepts a fully valid input with audition source', () => {
    const input = { ...baseInput, source: validAuditionSource };
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

  it('rejects message longer than MAX_GUILD_INVITE_MESSAGE_LENGTH', () => {
    expect(() =>
      InviteUserToGuildInputSchema.parse({
        ...baseInput,
        message: 'x'.repeat(MAX_GUILD_INVITE_MESSAGE_LENGTH + 1),
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

describe('ListGuildInvitesInputSchema', () => {
  it('accepts finalized (the terminal success state) in the statuses filter', () => {
    const parsed = ListGuildInvitesInputSchema.parse({
      workProjectId: 'workProject-1',
      statuses: ['finalized'],
    });
    expect(parsed.statuses).toContain('finalized');
  });

  it('accepts the full terminal + in-flight set', () => {
    const statuses = ['pending', 'accepted', 'declined', 'cancelled', 'finalized'] as const;
    expect(
      ListGuildInvitesInputSchema.parse({ workProjectId: 'workProject-1', statuses: [...statuses] }).statuses,
    ).toEqual([...statuses]);
  });

  it('rejects the removed dead "error" status', () => {
    expect(() =>
      ListGuildInvitesInputSchema.parse({ workProjectId: 'workProject-1', statuses: ['error'] }),
    ).toThrow();
  });

  it('rejects an empty statuses array', () => {
    expect(() =>
      ListGuildInvitesInputSchema.parse({ workProjectId: 'workProject-1', statuses: [] }),
    ).toThrow();
  });
});

describe('realmWorkingTitleSchema (reservedRealmNames doc-ID safety)', () => {
  it('accepts an ordinary title', () => {
    expect(realmWorkingTitleSchema.parse('Tales of Wonder')).toBe('Tales of Wonder');
  });

  it('rejects a title containing a slash (breaks the reservedRealmNames doc path)', () => {
    expect(() => realmWorkingTitleSchema.parse('Tales of A/B Testing')).toThrow();
  });

  it('rejects the reserved doc IDs "." and ".."', () => {
    expect(() => realmWorkingTitleSchema.parse('.')).toThrow();
    expect(() => realmWorkingTitleSchema.parse('..')).toThrow();
  });

  it('is enforced identically by CheckRealmNameAvailableInputSchema and CreateWorkProjectInputSchema', () => {
    // Same schema on both surfaces — a name valid at create is never rejected at form time.
    const validCreateBase = {
      workingTitle: 'Work',
      workingDescription: 'desc',
      workProjectType: 'Tales' as const,
      hallWingType: 'entertainment' as const,
      realmCreationMode: 'newPublicRealm' as const,
      realmWorkingDescription: 'realm desc',
    };
    // A valid realm title parses on both surfaces.
    expect(CheckRealmNameAvailableInputSchema.parse({ workingTitle: 'Good Realm' }).workingTitle).toBe('Good Realm');
    expect(
      CreateWorkProjectInputSchema.parse({ ...validCreateBase, realmWorkingTitle: 'Good Realm' }).realmCreationMode,
    ).toBe('newPublicRealm');
    // The slash-bearing title is rejected on both (only the realm title is invalid here).
    expect(() => CheckRealmNameAvailableInputSchema.parse({ workingTitle: 'A/B' })).toThrow();
    expect(() =>
      CreateWorkProjectInputSchema.parse({ ...validCreateBase, realmWorkingTitle: 'A/B' }),
    ).toThrow();
  });
});



