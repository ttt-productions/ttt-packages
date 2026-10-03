import { describe, it, expect } from 'vitest';
import {
  InviteSourceSchema,
  InviteUserToGuildInputSchema,
  ListGuildInvitesInputSchema,
  CheckRealmNameAvailableInputSchema,
  CreateWorkProjectInputSchema,
  CreateWorkProjectResultSchema,
  realmWorkingTitleSchema,
} from '../src/schemas/work-project-management';
import { ListGuildInvitesResultSchema } from '../src/schemas';
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


describe('ListGuildInvitesInputSchema paging', () => {
  it('takes the opaque cursor the previous page answered', () => {
    const parsed = ListGuildInvitesInputSchema.parse({
      workProjectId: 'workProject-1',
      statuses: ['finalized'],
      cursor: 'opaque-token',
    });
    expect(parsed.cursor).toBe('opaque-token');
  });

  it('reads the first page when no cursor is sent', () => {
    const parsed = ListGuildInvitesInputSchema.parse({ workProjectId: 'workProject-1', statuses: ['pending'] });
    expect(parsed.cursor).toBeUndefined();
  });

  it('refuses an empty cursor', () => {
    expect(
      ListGuildInvitesInputSchema.safeParse({ workProjectId: 'workProject-1', statuses: ['pending'], cursor: '' }).success,
    ).toBe(false);
  });

  it('refuses a client page size — the server owns it', () => {
    expect(
      ListGuildInvitesInputSchema.safeParse({ workProjectId: 'workProject-1', statuses: ['pending'], limit: 500 }).success,
    ).toBe(false);
  });
});

describe('ListGuildInvitesResultSchema', () => {
  const invite = {
    guildInviteId: 'gi1',
    workProjectId: 'wp1',
    relatedUserIds: ['u1', 'u2'],
    workProject: { workProjectId: 'wp1', type: 'tales' },
    createdBy: { uid: 'u1' },
    sender: { uid: 'u1' },
    recipient: { uid: 'u2' },
    stakeSharesOffered: 10,
    source: { type: 'standalone' as const },
    status: 'pending' as const,
    createdAt: 1,
    updatedAt: 1,
    lastUpdatedAt: 1,
    senderConfirmed: false,
    recipientConfirmed: false,
  };

  it('is one page of stored invites plus the cursor of the next page', () => {
    const parsed = ListGuildInvitesResultSchema.parse({ invites: [invite], nextCursor: 'next' });
    expect(parsed.invites).toHaveLength(1);
    expect(parsed.nextCursor).toBe('next');
  });

  it('marks the last page with a null cursor', () => {
    expect(ListGuildInvitesResultSchema.parse({ invites: [], nextCursor: null }).nextCursor).toBeNull();
  });

  it('always answers whether another page exists', () => {
    expect(ListGuildInvitesResultSchema.safeParse({ invites: [invite] }).success).toBe(false);
  });

  it('carries each invite in its stored document shape', () => {
    const { status: _status, ...withoutStatus } = invite;
    expect(ListGuildInvitesResultSchema.safeParse({ invites: [withoutStatus], nextCursor: null }).success).toBe(false);
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




describe('CreateWorkProjectResultSchema', () => {
  const createdWork = {
    workProjectId: 'work-1',
    createdOn: 1_700_000_000_000,
    type: 'Tales',
    workingDescription: 'A working description',
    workingTitle: 'A Working Title',
    hallWingType: 'entertainment',
    createdBy: { uid: 'user-1' },
    status: 'open',
    workRealmId: 'realm-1',
    realmCanonStatus: 'canon',
  } as const;

  it("answers success, the new Work's id, and its stored document", () => {
    const result = { success: true, workProjectId: 'work-1', workProjectData: createdWork };
    expect(CreateWorkProjectResultSchema.parse(result)).toEqual(result);
  });

  it('is the answer of a create that succeeded — never a failure shape', () => {
    expect(
      CreateWorkProjectResultSchema.safeParse({ success: false, workProjectId: 'work-1', workProjectData: createdWork })
        .success,
    ).toBe(false);
  });

  it('carries the stored Work document whole, so a document its schema refuses is refused here too', () => {
    const { workRealmId: _omitted, ...withoutRealm } = createdWork;
    expect(
      CreateWorkProjectResultSchema.safeParse({ success: true, workProjectId: 'work-1', workProjectData: withoutRealm })
        .success,
    ).toBe(false);
  });

  it("names the document it returns: the answered id is that Work's own id", () => {
    expect(
      CreateWorkProjectResultSchema.safeParse({ success: true, workProjectId: 'work-2', workProjectData: createdWork })
        .success,
    ).toBe(false);
  });

  it('accepts nothing beyond the three answered fields', () => {
    expect(
      CreateWorkProjectResultSchema.safeParse({
        success: true,
        workProjectId: 'work-1',
        workProjectData: createdWork,
        workRealmId: 'realm-1',
      }).success,
    ).toBe(false);
  });
});
