import { describe, it, expect } from 'vitest';
import {
  InviteSourceSchema,
  InviteUserToProjectInputSchema,
} from '../src/schemas/project-management';
import { MAX_INVITE_MESSAGE_LENGTH } from '../src/constants/business';

const validStandaloneSource = { type: 'standalone' } as const;

const validSkillSource = {
  type: 'skill',
  data: {
    skillId: 'skill-1',
    skillOwnerUserId: 'user-1',
    skillName: 'Guitar',
  },
} as const;

const validJobSource = {
  type: 'job',
  data: {
    jobId: 'job-1',
    replyId: 'reply-1',
    jobTitle: 'Lead Developer',
    applicantUserId: 'user-2',
    postingSharesOffered: 10,
  },
} as const;

const validOpportunitySource = {
  type: 'opportunity',
  data: {
    opportunityId: 'opp-1',
    replyId: 'reply-2',
    opportunityTitle: 'Featured Placement',
    respondentUserId: 'user-3',
    postingSharesOffered: 5,
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

  it('accepts a valid skill source', () => {
    expect(InviteSourceSchema.parse(validSkillSource)).toEqual(validSkillSource);
  });

  it('accepts a valid job source', () => {
    expect(InviteSourceSchema.parse(validJobSource)).toEqual(validJobSource);
  });

  it('accepts a valid opportunity source', () => {
    expect(InviteSourceSchema.parse(validOpportunitySource)).toEqual(validOpportunitySource);
  });

  it('rejects unknown type value', () => {
    expect(() =>
      InviteSourceSchema.parse({ type: 'referral' }),
    ).toThrow();
  });

  it('rejects nested unknown keys inside job data (.strict)', () => {
    expect(() =>
      InviteSourceSchema.parse({
        type: 'job',
        data: {
          ...validJobSource.data,
          unknownField: 'bad',
        },
      }),
    ).toThrow();
  });

  it('rejects nested unknown keys inside skill data (.strict)', () => {
    expect(() =>
      InviteSourceSchema.parse({
        type: 'skill',
        data: {
          ...validSkillSource.data,
          extraKey: true,
        },
      }),
    ).toThrow();
  });

  it('rejects postingSharesOffered: 0 on job branch', () => {
    expect(() =>
      InviteSourceSchema.parse({
        type: 'job',
        data: { ...validJobSource.data, postingSharesOffered: 0 },
      }),
    ).toThrow();
  });

  it('rejects postingSharesOffered: 0 on opportunity branch', () => {
    expect(() =>
      InviteSourceSchema.parse({
        type: 'opportunity',
        data: { ...validOpportunitySource.data, postingSharesOffered: 0 },
      }),
    ).toThrow();
  });
});

describe('InviteUserToProjectInputSchema', () => {
  const baseInput = {
    projectId: 'project-1',
    inviteeUid: 'user-99',
    message: 'Join us!',
    sharesOffered: 10,
  };

  it('accepts a fully valid input with standalone source', () => {
    const input = { ...baseInput, source: validStandaloneSource };
    expect(InviteUserToProjectInputSchema.parse(input)).toEqual(input);
  });

  it('accepts a fully valid input with skill source', () => {
    const input = { ...baseInput, source: validSkillSource };
    expect(InviteUserToProjectInputSchema.parse(input)).toEqual(input);
  });

  it('accepts a fully valid input with job source', () => {
    const input = { ...baseInput, source: validJobSource };
    expect(InviteUserToProjectInputSchema.parse(input)).toEqual(input);
  });

  it('accepts a fully valid input with opportunity source', () => {
    const input = { ...baseInput, source: validOpportunitySource };
    expect(InviteUserToProjectInputSchema.parse(input)).toEqual(input);
  });

  it('rejects missing source', () => {
    expect(() =>
      InviteUserToProjectInputSchema.parse(baseInput),
    ).toThrow();
  });

  it('rejects sharesOffered: 0', () => {
    expect(() =>
      InviteUserToProjectInputSchema.parse({
        ...baseInput,
        sharesOffered: 0,
        source: validStandaloneSource,
      }),
    ).toThrow();
  });

  it('rejects empty message', () => {
    expect(() =>
      InviteUserToProjectInputSchema.parse({
        ...baseInput,
        message: '',
        source: validStandaloneSource,
      }),
    ).toThrow();
  });

  it('rejects message longer than MAX_INVITE_MESSAGE_LENGTH', () => {
    expect(() =>
      InviteUserToProjectInputSchema.parse({
        ...baseInput,
        message: 'x'.repeat(MAX_INVITE_MESSAGE_LENGTH + 1),
        source: validStandaloneSource,
      }),
    ).toThrow();
  });

  it('rejects unknown top-level keys (.strict)', () => {
    expect(() =>
      InviteUserToProjectInputSchema.parse({
        ...baseInput,
        source: validStandaloneSource,
        extraField: 'bad',
      }),
    ).toThrow();
  });
});
