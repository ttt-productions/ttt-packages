import { describe, it, expect } from 'vitest';
import {
  parseTargetInfo,
  ProfilePictureTargetInfoSchema,
  SkillMediaTargetInfoSchema,
  StreetzTargetInfoSchema,
  JobPostingTargetInfoSchema,
  JobReplyTargetInfoSchema,
  OpportunityPromptTargetInfoSchema,
  AdminOpportunityPromptTargetInfoSchema,
  OpportunityReplyTargetInfoSchema,
  LibraryCoverSquareTargetInfoSchema,
  ChapterPhotoTargetInfoSchema,
  SongPhotoTargetInfoSchema,
  ShowPhotoTargetInfoSchema,
  ChatAttachmentTargetInfoSchema,
} from '../src/media/target-info.js';
import { LIBRARY_TARGET_FIELDS } from '../src/media/hall-library-target-fields.js';

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
    title: 'Test commission',
    description: 'desc',
    requiredTradeProfessions: ['actor'],
    sharesOffered: 5,
    projectId: 'p_1',
    createdBy: { uid: 'u_1' },
  };
  it('accepts valid', () => { expect(() => JobPostingTargetInfoSchema.parse(valid)).not.toThrow(); });
  it('rejects missing projectId', () => {
    const { projectId, ...rest } = valid;
    expect(() => JobPostingTargetInfoSchema.parse(rest)).toThrow();
  });
});

describe('JobReplyTargetInfoSchema', () => {
  it('accepts valid', () => {
    expect(() => JobReplyTargetInfoSchema.parse({ jobId: 'j', replyText: 'r' })).not.toThrow();
  });
});

describe('OpportunityPromptTargetInfoSchema', () => {
  const valid = {
    opportunityId: 'op_1',
    type: 'ProjectInput' as const,
    title: 'T',
    description: 'D',
    openTill: 1_700_000_000_000,
    createdBy: { uid: 'u_1' },
    projectId: 'p_1',
  };
  it('accepts minimum required fields', () => {
    expect(() => OpportunityPromptTargetInfoSchema.parse(valid)).not.toThrow();
  });
  it("rejects type: 'SystemInput'", () => {
    expect(() => OpportunityPromptTargetInfoSchema.parse({ ...valid, type: 'SystemInput' })).toThrow();
  });
});

describe('AdminOpportunityPromptTargetInfoSchema', () => {
  const valid = {
    opportunityId: 'op_1',
    type: 'SystemInput' as const,
    title: 'T',
    description: 'D',
    openTill: 1_700_000_000_000,
    createdBy: { uid: 'u_1' },
  };
  it('accepts SystemInput', () => {
    expect(() => AdminOpportunityPromptTargetInfoSchema.parse(valid)).not.toThrow();
  });
  it('accepts SponsoredProjects with projectAmountUSD', () => {
    expect(() => AdminOpportunityPromptTargetInfoSchema.parse({
      ...valid, type: 'SponsoredProjects', projectAmountUSD: 5000,
    })).not.toThrow();
  });
  it("rejects type: 'ProjectInput'", () => {
    expect(() => AdminOpportunityPromptTargetInfoSchema.parse({ ...valid, type: 'ProjectInput' })).toThrow();
  });
});

describe('OpportunityReplyTargetInfoSchema', () => {
  it('accepts valid', () => {
    expect(() => OpportunityReplyTargetInfoSchema.parse({ opportunityId: 'op_1' })).not.toThrow();
  });
});

describe('LibraryCoverSquareTargetInfoSchema (typed IDs)', () => {
  const valid = { projectId: 'p_1', itemType: 'tale' as const, itemId: 'tale_1' };
  it('accepts valid typed IDs', () => {
    expect(() => LibraryCoverSquareTargetInfoSchema.parse(valid)).not.toThrow();
  });
  it('accepts itemType tune', () => {
    expect(() => LibraryCoverSquareTargetInfoSchema.parse({ ...valid, itemType: 'tune' })).not.toThrow();
  });
  it('accepts itemType television', () => {
    expect(() => LibraryCoverSquareTargetInfoSchema.parse({ ...valid, itemType: 'television' })).not.toThrow();
  });
  it('rejects legacy { docPath, fields } shape', () => {
    expect(() =>
      LibraryCoverSquareTargetInfoSchema.parse({ docPath: 'allWorkProjects/p_1/workProjectTales/tale_1', fields: { full: 'coverPhotoSquare' } })
    ).toThrow();
  });
  it('rejects unknown itemType', () => {
    expect(() => LibraryCoverSquareTargetInfoSchema.parse({ ...valid, itemType: 'film' })).toThrow();
  });
  it('rejects missing projectId', () => {
    const { projectId, ...rest } = valid;
    expect(() => LibraryCoverSquareTargetInfoSchema.parse(rest)).toThrow();
  });
  it('rejects extra keys', () => {
    expect(() => LibraryCoverSquareTargetInfoSchema.parse({ ...valid, extra: 'x' })).toThrow();
  });
});

describe('ChapterPhotoTargetInfoSchema (typed IDs)', () => {
  const valid = { projectId: 'p_1', taleId: 'tale_1', chapterId: 'ch_1' };
  it('accepts valid typed IDs', () => {
    expect(() => ChapterPhotoTargetInfoSchema.parse(valid)).not.toThrow();
  });
  it('rejects legacy { docPath, fields } shape', () => {
    expect(() =>
      ChapterPhotoTargetInfoSchema.parse({ docPath: 'allWorkProjects/p_1/workProjectTales/tale_1/taleChapters/ch_1', fields: { full: 'photoUrl' } })
    ).toThrow();
  });
  it('rejects missing chapterId', () => {
    const { chapterId, ...rest } = valid;
    expect(() => ChapterPhotoTargetInfoSchema.parse(rest)).toThrow();
  });
  it('rejects extra keys', () => {
    expect(() => ChapterPhotoTargetInfoSchema.parse({ ...valid, extra: 'x' })).toThrow();
  });
});

describe('ChatAttachmentTargetInfoSchema', () => {
  it('accepts projectChannel with required fields', () => {
    expect(() => ChatAttachmentTargetInfoSchema.parse({
      threadKind: 'projectChannel', projectId: 'p_1', channelId: 'c_1',
    })).not.toThrow();
  });
  it('accepts guildInvite', () => {
    expect(() => ChatAttachmentTargetInfoSchema.parse({
      threadKind: 'guildInvite', inviteId: 'inv_1',
    })).not.toThrow();
  });
  it('accepts adminSupport', () => {
    expect(() => ChatAttachmentTargetInfoSchema.parse({
      threadKind: 'adminSupport', adminMessageId: 'msg_1', isUserReply: true,
    })).not.toThrow();
  });
  it('rejects unknown threadKind', () => {
    expect(() => ChatAttachmentTargetInfoSchema.parse({
      threadKind: 'unknown', projectId: 'p_1',
    })).toThrow();
  });
});

describe('SongPhotoTargetInfoSchema (typed IDs)', () => {
  const valid = { projectId: 'p_1', tuneId: 'tune_1', trackId: 'song_1' };
  it('accepts valid typed IDs', () => {
    expect(() => SongPhotoTargetInfoSchema.parse(valid)).not.toThrow();
  });
  it('rejects legacy { docPath, fields } shape', () => {
    expect(() =>
      SongPhotoTargetInfoSchema.parse({ docPath: 'x', fields: { full: 'photoUrl' } })
    ).toThrow();
  });
});

describe('ShowPhotoTargetInfoSchema (typed IDs)', () => {
  const valid = { projectId: 'p_1', televisionId: 'tv_1', episodeId: 'show_1' };
  it('accepts valid typed IDs', () => {
    expect(() => ShowPhotoTargetInfoSchema.parse(valid)).not.toThrow();
  });
  it('rejects legacy { docPath, fields } shape', () => {
    expect(() =>
      ShowPhotoTargetInfoSchema.parse({ docPath: 'x', fields: { full: 'photoUrl' } })
    ).toThrow();
  });
});

describe('LIBRARY_TARGET_FIELDS', () => {
  it('maps hallLibrary-cover-square to coverPhotoSquare', () => {
    expect(LIBRARY_TARGET_FIELDS['hallLibrary-cover-square']).toBe('coverPhotoSquare');
  });
  it('maps hallLibrary-cover-poster to coverPhotoPoster', () => {
    expect(LIBRARY_TARGET_FIELDS['hallLibrary-cover-poster']).toBe('coverPhotoPoster');
  });
  it('maps hallLibrary-cover-cinematic to coverPhotoCinematic', () => {
    expect(LIBRARY_TARGET_FIELDS['hallLibrary-cover-cinematic']).toBe('coverPhotoCinematic');
  });
  it('maps chapter-photo to photoUrl', () => {
    expect(LIBRARY_TARGET_FIELDS['chapter-photo']).toBe('photoUrl');
  });
  it('maps song-photo to photoUrl', () => {
    expect(LIBRARY_TARGET_FIELDS['song-photo']).toBe('photoUrl');
  });
  it('maps song-audio to fileUrl', () => {
    expect(LIBRARY_TARGET_FIELDS['song-audio']).toBe('fileUrl');
  });
  it('maps show-photo to photoUrl', () => {
    expect(LIBRARY_TARGET_FIELDS['show-photo']).toBe('photoUrl');
  });
  it('maps show-video to videoUrl', () => {
    expect(LIBRARY_TARGET_FIELDS['show-video']).toBe('videoUrl');
  });
});

describe('parseTargetInfo dispatch', () => {
  it('dispatches to profile-picture schema', () => {
    expect(parseTargetInfo('profile-picture', {})).toEqual({});
  });
  it('dispatches to craftSkill-media schema', () => {
    const result = parseTargetInfo('craftSkill-media', { skillId: 's_1', skillType: 'image', originalFileName: 'a.jpg' });
    expect(result).toMatchObject({ skillId: 's_1' });
  });
  it('dispatches to chat-attachment schema', () => {
    const result = parseTargetInfo('chat-attachment', { threadKind: 'projectChannel', projectId: 'p_1', channelId: 'c_1' });
    expect(result).toMatchObject({ threadKind: 'projectChannel', projectId: 'p_1', channelId: 'c_1' });
  });
  it('throws on schema mismatch', () => {
    expect(() => parseTargetInfo('craftSkill-media', { wrongShape: true })).toThrow();
  });
});
