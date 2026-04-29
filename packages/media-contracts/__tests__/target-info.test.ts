import { describe, it, expect } from 'vitest';
import {
  parseTargetInfo,
  ProfilePictureTargetInfoSchema,
  SkillMediaTargetInfoSchema,
  StreetzTargetInfoSchema,
  JobPostingTargetInfoSchema,
  JobReplyTargetInfoSchema,
  OpportunityPromptTargetInfoSchema,
  OpportunityReplyTargetInfoSchema,
  LibraryCoverSquareTargetInfoSchema,
  ChapterPhotoTargetInfoSchema,
  ChatAttachmentTargetInfoSchema,
} from '../src/schemas';

describe('ProfilePictureTargetInfoSchema', () => {
  it('accepts empty object', () => {
    expect(() => ProfilePictureTargetInfoSchema.parse({})).not.toThrow();
  });
  it('rejects unknown fields', () => {
    expect(() => ProfilePictureTargetInfoSchema.parse({ skillId: 'x' })).toThrow();
  });
});

describe('SkillMediaTargetInfoSchema', () => {
  const valid = { skillId: 'sk_1', skillType: 'image' as const, originalFileName: 'a.jpg' };
  it('accepts valid', () => { expect(() => SkillMediaTargetInfoSchema.parse(valid)).not.toThrow(); });
  it('rejects unknown skillType', () => {
    expect(() => SkillMediaTargetInfoSchema.parse({ ...valid, skillType: 'pdf' })).toThrow();
  });
  it('rejects missing skillId', () => {
    const { skillId, ...rest } = valid;
    expect(() => SkillMediaTargetInfoSchema.parse(rest)).toThrow();
  });
  it('rejects unknown fields', () => {
    expect(() => SkillMediaTargetInfoSchema.parse({ ...valid, extra: 1 })).toThrow();
  });
});

describe('StreetzTargetInfoSchema', () => {
  const validMention = {
    placeholder: '@m1',
    type: 'user' as const,
    id: 'user_abc',
    text: '@John Doe',
  };
  it('accepts empty mentions', () => {
    expect(() => StreetzTargetInfoSchema.parse({ mentions: [] })).not.toThrow();
  });
  it('accepts populated mentions', () => {
    expect(() => StreetzTargetInfoSchema.parse({ mentions: [validMention] })).not.toThrow();
  });
  it('rejects string mentions (must be Mention objects)', () => {
    expect(() => StreetzTargetInfoSchema.parse({ mentions: ['user_1'] })).toThrow();
  });
  it('rejects mention with invalid type enum', () => {
    expect(() => StreetzTargetInfoSchema.parse({
      mentions: [{ ...validMention, type: 'bogus' }]
    })).toThrow();
  });
  it('rejects missing mentions', () => {
    expect(() => StreetzTargetInfoSchema.parse({})).toThrow();
  });
});

describe('JobPostingTargetInfoSchema', () => {
  const valid = {
    jobId: 'job_1',
    title: 'Test job',
    description: 'desc',
    requiredProfessions: ['actor'],
    sharesOffered: 5,
    projectAssociatedWith: { projectId: 'p_1', type: 'film', workingDescription: 'd', workingTitle: 't' },
    createdBy: { uid: 'u_1', displayName: 'Test User' },
  };
  it('accepts valid', () => { expect(() => JobPostingTargetInfoSchema.parse(valid)).not.toThrow(); });
  it('rejects missing projectAssociatedWith', () => {
    const { projectAssociatedWith, ...rest } = valid;
    expect(() => JobPostingTargetInfoSchema.parse(rest)).toThrow();
  });
  it('rejects bad ShortProject shape', () => {
    expect(() => JobPostingTargetInfoSchema.parse({
      ...valid,
      projectAssociatedWith: { projectId: 'p_1' },
    })).toThrow();
  });
});

describe('JobReplyTargetInfoSchema', () => {
  it('accepts valid', () => {
    expect(() => JobReplyTargetInfoSchema.parse({ jobId: 'j', projectId: 'p', replyText: 'r' })).not.toThrow();
  });
  it('rejects missing replyText', () => {
    expect(() => JobReplyTargetInfoSchema.parse({ jobId: 'j', projectId: 'p' })).toThrow();
  });
});

describe('OpportunityPromptTargetInfoSchema', () => {
  const valid = {
    opportunityId: 'op_1',
    type: 'ProjectInput' as const,
    title: 'T',
    description: 'D',
    openTill: 1_700_000_000_000,
    createdBy: { uid: 'u_1', displayName: 'Test' },
  };
  it('accepts minimum required fields', () => {
    expect(() => OpportunityPromptTargetInfoSchema.parse(valid)).not.toThrow();
  });
  it('accepts ProjectInput with optional fields', () => {
    expect(() => OpportunityPromptTargetInfoSchema.parse({
      ...valid, projectId: 'p_1', sharesOffered: 3,
    })).not.toThrow();
  });
  it('accepts SponsoredProjects with projectAmountUSD', () => {
    expect(() => OpportunityPromptTargetInfoSchema.parse({
      ...valid, type: 'SponsoredProjects', projectAmountUSD: 5000,
    })).not.toThrow();
  });
  it('rejects unknown type', () => {
    expect(() => OpportunityPromptTargetInfoSchema.parse({ ...valid, type: 'OtherType' })).toThrow();
  });
});

describe('OpportunityReplyTargetInfoSchema', () => {
  it('accepts valid', () => {
    expect(() => OpportunityReplyTargetInfoSchema.parse({ opportunityId: 'op_1' })).not.toThrow();
  });
  it('rejects missing opportunityId', () => {
    expect(() => OpportunityReplyTargetInfoSchema.parse({})).toThrow();
  });
});

describe('LibraryCoverSquareTargetInfoSchema', () => {
  it('accepts docPath + fields', () => {
    expect(() => LibraryCoverSquareTargetInfoSchema.parse({
      docPath: 'libraries/lib_1', fields: { full: 'coverPhotoSquare' },
    })).not.toThrow();
  });
  it('accepts multiple field keys', () => {
    expect(() => LibraryCoverSquareTargetInfoSchema.parse({
      docPath: 'libraries/lib_1', fields: { full: 'a', thumb: 'b' },
    })).not.toThrow();
  });
  it('rejects missing docPath', () => {
    expect(() => LibraryCoverSquareTargetInfoSchema.parse({ fields: { full: 'x' } })).toThrow();
  });
});

describe('ChapterPhotoTargetInfoSchema', () => {
  it('accepts docPath + fields.full', () => {
    expect(() => ChapterPhotoTargetInfoSchema.parse({
      docPath: 'projects/p_1/chapters/ch_1', fields: { full: 'photoUrl' },
    })).not.toThrow();
  });
  it('rejects fields with extra keys', () => {
    expect(() => ChapterPhotoTargetInfoSchema.parse({
      docPath: 'x', fields: { full: 'y', extra: 'z' },
    })).toThrow();
  });
});

describe('ChatAttachmentTargetInfoSchema', () => {
  it('accepts docPath only', () => {
    expect(() => ChatAttachmentTargetInfoSchema.parse({ docPath: 'threads/t_1/messages/m_1' })).not.toThrow();
  });
  it('rejects fields field present', () => {
    expect(() => ChatAttachmentTargetInfoSchema.parse({
      docPath: 'x', fields: { full: 'y' },
    })).toThrow();
  });
});

describe('parseTargetInfo dispatch', () => {
  it('dispatches to profile-picture schema', () => {
    expect(parseTargetInfo('profile-picture', {})).toEqual({});
  });
  it('dispatches to skill-media schema', () => {
    const result = parseTargetInfo('skill-media', { skillId: 's_1', skillType: 'image', originalFileName: 'a.jpg' });
    expect(result).toMatchObject({ skillId: 's_1' });
  });
  it('dispatches to chat-attachment schema', () => {
    expect(parseTargetInfo('chat-attachment', { docPath: 'x' })).toEqual({ docPath: 'x' });
  });
  it('throws on schema mismatch', () => {
    expect(() => parseTargetInfo('skill-media', { wrongShape: true })).toThrow();
  });
});
