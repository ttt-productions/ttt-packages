import { describe, it, expect } from 'vitest';
import {
  parseTargetInfo,
  ProfilePictureTargetInfoSchema,
  CraftSkillMediaTargetInfoSchema,
  SquareStreetzTargetInfoSchema,
  CommissionPostingTargetInfoSchema,
  CommissionProposalTargetInfoSchema,
  AuditionPromptTargetInfoSchema,
  AdminAuditionPromptTargetInfoSchema,
  AuditionEntryTargetInfoSchema,
  LibraryCoverSquareTargetInfoSchema,
  ChapterPhotoTargetInfoSchema,
  TuneTrackPhotoTargetInfoSchema,
  TelevisionEpisodePhotoTargetInfoSchema,
  ChatAttachmentTargetInfoSchema,
} from '../src/media/target-info.js';
import { LIBRARY_TARGET_FIELDS } from '../src/media/hall-library-target-fields.js';

describe('ProfilePictureTargetInfoSchema', () => {
  it('accepts empty object', () => {
    expect(() => ProfilePictureTargetInfoSchema.parse({})).not.toThrow();
  });
  it('rejects unknown fields', () => {
    expect(() => ProfilePictureTargetInfoSchema.parse({ craftSkillId: 'x' })).toThrow();
  });
});

describe('CraftSkillMediaTargetInfoSchema', () => {
  const valid = { craftSkillId: 'sk_1', skillType: 'image' as const, originalFileName: 'a.jpg' };
  it('accepts valid', () => { expect(() => CraftSkillMediaTargetInfoSchema.parse(valid)).not.toThrow(); });
  it('rejects unknown skillType', () => {
    expect(() => CraftSkillMediaTargetInfoSchema.parse({ ...valid, skillType: 'pdf' })).toThrow();
  });
  it('rejects missing craftSkillId', () => {
    const { craftSkillId, ...rest } = valid;
    expect(() => CraftSkillMediaTargetInfoSchema.parse(rest)).toThrow();
  });
  it('rejects unknown fields', () => {
    expect(() => CraftSkillMediaTargetInfoSchema.parse({ ...valid, extra: 1 })).toThrow();
  });
});

describe('SquareStreetzTargetInfoSchema', () => {
  const validMention = {
    placeholder: '@m1',
    type: 'user' as const,
    id: 'user_abc',
    text: '@John Doe',
  };
  it('accepts empty mentions', () => {
    expect(() => SquareStreetzTargetInfoSchema.parse({ mentions: [] })).not.toThrow();
  });
  it('accepts populated mentions', () => {
    expect(() => SquareStreetzTargetInfoSchema.parse({ mentions: [validMention] })).not.toThrow();
  });
  it('rejects string mentions (must be Mention objects)', () => {
    expect(() => SquareStreetzTargetInfoSchema.parse({ mentions: ['user_1'] })).toThrow();
  });
  it('rejects mention with invalid type enum', () => {
    expect(() => SquareStreetzTargetInfoSchema.parse({
      mentions: [{ ...validMention, type: 'bogus' }]
    })).toThrow();
  });
  it('rejects missing mentions', () => {
    expect(() => SquareStreetzTargetInfoSchema.parse({})).toThrow();
  });
});

describe('CommissionPostingTargetInfoSchema', () => {
  const valid = {
    commissionListingId: 'job_1',
    title: 'Test commission',
    description: 'desc',
    requiredTradeProfessions: ['actor'],
    stakeSharesOffered: 5,
    workProjectId: 'p_1',
    createdBy: { uid: 'u_1' },
  };
  it('accepts valid', () => { expect(() => CommissionPostingTargetInfoSchema.parse(valid)).not.toThrow(); });
  it('rejects missing workProjectId', () => {
    const { workProjectId, ...rest } = valid;
    expect(() => CommissionPostingTargetInfoSchema.parse(rest)).toThrow();
  });
});

describe('CommissionProposalTargetInfoSchema', () => {
  it('accepts valid', () => {
    expect(() => CommissionProposalTargetInfoSchema.parse({ commissionListingId: 'j', replyText: 'r' })).not.toThrow();
  });
});

describe('AuditionPromptTargetInfoSchema', () => {
  const valid = {
    auditionId: 'op_1',
    type: 'workAudition' as const,
    title: 'T',
    description: 'D',
    openTill: 1_700_000_000_000,
    createdBy: { uid: 'u_1' },
    workProjectId: 'p_1',
  };
  it('accepts minimum required fields', () => {
    expect(() => AuditionPromptTargetInfoSchema.parse(valid)).not.toThrow();
  });
  it("rejects type: 'platformAudition'", () => {
    expect(() => AuditionPromptTargetInfoSchema.parse({ ...valid, type: 'platformAudition' })).toThrow();
  });
});

describe('AdminAuditionPromptTargetInfoSchema', () => {
  const valid = {
    auditionId: 'op_1',
    type: 'platformAudition' as const,
    title: 'T',
    description: 'D',
    openTill: 1_700_000_000_000,
    createdBy: { uid: 'u_1' },
  };
  it('accepts platformAudition', () => {
    expect(() => AdminAuditionPromptTargetInfoSchema.parse(valid)).not.toThrow();
  });
  it('accepts sponsoredAudition with sponsoredAuditionAmountUSD', () => {
    expect(() => AdminAuditionPromptTargetInfoSchema.parse({
      ...valid, type: 'sponsoredAudition', sponsoredAuditionAmountUSD: 5000,
    })).not.toThrow();
  });
  it("rejects type: 'workAudition'", () => {
    expect(() => AdminAuditionPromptTargetInfoSchema.parse({ ...valid, type: 'workAudition' })).toThrow();
  });
});

describe('AuditionEntryTargetInfoSchema', () => {
  it('accepts valid', () => {
    expect(() => AuditionEntryTargetInfoSchema.parse({ auditionId: 'op_1' })).not.toThrow();
  });
});

describe('LibraryCoverSquareTargetInfoSchema (typed IDs)', () => {
  const valid = { workProjectId: 'p_1', itemType: 'tale' as const, itemId: 'tale_1' };
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
  it('rejects missing workProjectId', () => {
    const { workProjectId, ...rest } = valid;
    expect(() => LibraryCoverSquareTargetInfoSchema.parse(rest)).toThrow();
  });
  it('rejects extra keys', () => {
    expect(() => LibraryCoverSquareTargetInfoSchema.parse({ ...valid, extra: 'x' })).toThrow();
  });
});

describe('ChapterPhotoTargetInfoSchema (typed IDs)', () => {
  const valid = { workProjectId: 'p_1', taleId: 'tale_1', chapterId: 'ch_1' };
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
  it('accepts guildChatChannel with required fields', () => {
    expect(() => ChatAttachmentTargetInfoSchema.parse({
      threadKind: 'guildChatChannel', workProjectId: 'p_1', guildChatChannelId: 'c_1',
    })).not.toThrow();
  });
  it('accepts guildInvite', () => {
    expect(() => ChatAttachmentTargetInfoSchema.parse({
      threadKind: 'guildInvite', inviteId: 'inv_1',
    })).not.toThrow();
  });
  it('accepts adminSupport', () => {
    expect(() => ChatAttachmentTargetInfoSchema.parse({
      threadKind: 'adminSupport', adminDispatchId: 'msg_1', isUserReply: true,
    })).not.toThrow();
  });
  it('rejects unknown threadKind', () => {
    expect(() => ChatAttachmentTargetInfoSchema.parse({
      threadKind: 'unknown', workProjectId: 'p_1',
    })).toThrow();
  });
});

describe('TuneTrackPhotoTargetInfoSchema (typed IDs)', () => {
  const valid = { workProjectId: 'p_1', tuneId: 'tune_1', trackId: 'song_1' };
  it('accepts valid typed IDs', () => {
    expect(() => TuneTrackPhotoTargetInfoSchema.parse(valid)).not.toThrow();
  });
  it('rejects legacy { docPath, fields } shape', () => {
    expect(() =>
      TuneTrackPhotoTargetInfoSchema.parse({ docPath: 'x', fields: { full: 'photoUrl' } })
    ).toThrow();
  });
});

describe('TelevisionEpisodePhotoTargetInfoSchema (typed IDs)', () => {
  const valid = { workProjectId: 'p_1', televisionId: 'tv_1', episodeId: 'show_1' };
  it('accepts valid typed IDs', () => {
    expect(() => TelevisionEpisodePhotoTargetInfoSchema.parse(valid)).not.toThrow();
  });
  it('rejects legacy { docPath, fields } shape', () => {
    expect(() =>
      TelevisionEpisodePhotoTargetInfoSchema.parse({ docPath: 'x', fields: { full: 'photoUrl' } })
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
  it('maps tune-track-photo to photoUrl', () => {
    expect(LIBRARY_TARGET_FIELDS['tune-track-photo']).toBe('photoUrl');
  });
  it('maps tune-track-audio to fileUrl', () => {
    expect(LIBRARY_TARGET_FIELDS['tune-track-audio']).toBe('fileUrl');
  });
  it('maps television-episode-photo to photoUrl', () => {
    expect(LIBRARY_TARGET_FIELDS['television-episode-photo']).toBe('photoUrl');
  });
  it('maps television-episode-video to videoUrl', () => {
    expect(LIBRARY_TARGET_FIELDS['television-episode-video']).toBe('videoUrl');
  });
});

describe('parseTargetInfo dispatch', () => {
  it('dispatches to profile-picture schema', () => {
    expect(parseTargetInfo('profile-picture', {})).toEqual({});
  });
  it('dispatches to craft-skill-media schema', () => {
    const result = parseTargetInfo('craft-skill-media', { craftSkillId: 's_1', skillType: 'image', originalFileName: 'a.jpg' });
    expect(result).toMatchObject({ craftSkillId: 's_1' });
  });
  it('dispatches to guild-chat-message-attachment schema', () => {
    const result = parseTargetInfo('guild-chat-message-attachment', { threadKind: 'guildChatChannel', workProjectId: 'p_1', guildChatChannelId: 'c_1' });
    expect(result).toMatchObject({ threadKind: 'guildChatChannel', workProjectId: 'p_1', guildChatChannelId: 'c_1' });
  });
  it('throws on schema mismatch', () => {
    expect(() => parseTargetInfo('craft-skill-media', { wrongShape: true })).toThrow();
  });
});



