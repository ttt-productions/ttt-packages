import { describe, it, expect } from 'vitest';
import {
  MEDIA_PUBLICATION_ARGS_SCHEMAS,
  ProfilePicturePublicationArgsSchema,
  CraftSkillMediaPublicationArgsSchema,
  WorkAssetPublicationArgsSchema,
  HallCoverPublicationArgsSchema,
  RealmCoverPublicationArgsSchema,
  WorkContentMediaPublicationArgsSchema,
  ConversationFilePublicationArgsSchema,
  SquarePostMediaPublicationArgsSchema,
  CommissionListingMediaPublicationArgsSchema,
  CommissionProposalMediaPublicationArgsSchema,
  AuditionMediaPublicationArgsSchema,
  SystemVideoSlotPublicationArgsSchema,
} from '../src/media/publication/publication-args.js';
import { MediaPublicationKindSchema } from '../src/doc-schemas/media-assets.js';
import { CRAFT_SKILL_TAG_VALUES } from '../src/constants/options.js';
import { MAX_CRAFT_SKILL_TAGS } from '../src/constants/business-user.js';
import { SYSTEM_SLOTS } from '../src/system-slots/system-slots.js';

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

const craftSkill = {
  userId: 'u1',
  craftSkillId: 'skill-1',
  name: 'My sketch',
  skillType: 'image',
  kind: 'original',
  attestation: { statementKind: 'original', statementVersion: 1, agreedAt: NOW },
  tags: [CRAFT_SKILL_TAG_VALUES[0]],
};
const workAsset = {
  workProjectId: 'wp1',
  folderId: 'folder-1',
  workFileId: 'file-1',
  userId: 'u1',
  name: 'design.png',
  size: 1234,
  contentType: 'image/png',
  mediaKind: 'image',
};
const conversationFile = {
  conversation: { kind: 'adminSupport', adminDispatchId: 'dispatch-1' },
  conversationFileId: 'cf-1',
  uploadedByUid: 'u1',
  name: 'photo.jpg',
  mediaKind: 'image',
  contentType: 'image/jpeg',
  reservedBytes: 2048,
};
const squarePost = {
  userId: 'u1',
  postId: 'post-1',
  content: 'look @m1',
  mentions: [{ placeholder: '@m1', type: 'user', id: 'u2' }],
  mediaType: 'image',
};
const commissionListing = {
  commissionListingId: 'listing-1',
  userId: 'u1',
  title: 'A Job',
  description: 'desc',
  requiredTradeProfessions: ['writer'],
  postingStakeSharesOffered: 50,
  attachmentName: 'job.jpg',
  attachmentType: 'image',
  attachmentSize: 100,
  workProjectAssociatedWith: { workProjectId: 'wp1', type: 'tale' },
};
const commissionProposal = {
  commissionListingId: 'listing-1',
  userId: 'u1',
  coverLetterText: 'please pick me',
  replyFileType: 'image',
};
const workPrompt = {
  mode: 'workPrompt',
  userId: 'u1',
  auditionId: 'aud-1',
  workProjectId: 'wp1',
  title: 'A prompt',
  description: 'Describe it',
  entriesCloseAt: NOW + DAY,
  auditionCloseAt: NOW + 2 * DAY,
  submittedAt: NOW,
};
const adminPrompt = {
  mode: 'adminPrompt',
  userId: 'u1',
  auditionId: 'aud-2',
  auditionType: 'platformAudition',
  title: 'A prompt',
  description: 'Describe it',
  entriesCloseAt: NOW + DAY,
  auditionCloseAt: NOW + 2 * DAY,
  submittedAt: NOW,
};
const entry = {
  mode: 'entry',
  userId: 'u3',
  auditionId: 'aud-1',
  auditionEntryId: 'u3',
  submittedAt: NOW,
};

const videoSlotId = SYSTEM_SLOTS.find((slot) => slot.kind === 'video')!.id;
const nonVideoSlotId = SYSTEM_SLOTS.find((slot) => slot.kind !== 'video')!.id;

describe('media publication args', () => {
  it('every publication kind declares the args its job carries', () => {
    expect(Object.keys(MEDIA_PUBLICATION_ARGS_SCHEMAS).sort()).toEqual(
      [...MediaPublicationKindSchema.options].sort(),
    );
  });

  it('a well-formed job of every kind parses', () => {
    const valid: Record<keyof typeof MEDIA_PUBLICATION_ARGS_SCHEMAS, unknown> = {
      profilePicture: { userId: 'u1' },
      squarePostMedia: squarePost,
      workAsset,
      hallCover: { workProjectId: 'wp1', itemType: 'tale', itemId: 'tale-1' },
      realmCover: { workRealmId: 'realm-1' },
      workContentMedia: {
        workProjectId: 'wp1',
        itemType: 'chapter',
        parentId: 'tale-1',
        itemId: 'ch-1',
      },
      auditionMedia: workPrompt,
      commissionListingMedia: commissionListing,
      commissionProposalMedia: commissionProposal,
      craftSkillMedia: craftSkill,
      conversationFile,
      systemVideoSlot: { slotId: videoSlotId },
    };
    for (const [kind, schema] of Object.entries(MEDIA_PUBLICATION_ARGS_SCHEMAS)) {
      expect(schema.safeParse(valid[kind as keyof typeof valid]).success, kind).toBe(true);
    }
  });

  it('a stored job carrying a field its kind does not declare is refused', () => {
    expect(
      RealmCoverPublicationArgsSchema.safeParse({ workRealmId: 'realm-1', docPath: 'x/y' }).success,
    ).toBe(false);
    expect(
      WorkContentMediaPublicationArgsSchema.safeParse({
        workProjectId: 'wp1',
        itemType: 'chapter',
        parentId: 'tale-1',
        itemId: 'ch-1',
        extra: 1,
      }).success,
    ).toBe(false);
    expect(AuditionMediaPublicationArgsSchema.safeParse({ ...entry, title: 'x' }).success).toBe(
      false,
    );
  });

  it('a stored job whose id is not one path segment is refused, in every id field of every kind', () => {
    const notOneSegment = ['', '/', 'a/b', '.', '..', '__x__', 'x'.repeat(1501)];
    const idFields: ReadonlyArray<
      [
        string,
        { safeParse: (v: unknown) => { success: boolean } },
        Record<string, unknown>,
        string[],
      ]
    > = [
      ['profilePicture', ProfilePicturePublicationArgsSchema, { userId: 'u1' }, ['userId']],
      ['squarePostMedia', SquarePostMediaPublicationArgsSchema, squarePost, ['userId', 'postId']],
      [
        'workAsset',
        WorkAssetPublicationArgsSchema,
        workAsset,
        ['workProjectId', 'folderId', 'workFileId', 'userId'],
      ],
      [
        'hallCover',
        HallCoverPublicationArgsSchema,
        { workProjectId: 'wp1', itemType: 'tale', itemId: 'tale-1' },
        ['workProjectId', 'itemId'],
      ],
      ['realmCover', RealmCoverPublicationArgsSchema, { workRealmId: 'realm-1' }, ['workRealmId']],
      [
        'workContentMedia',
        WorkContentMediaPublicationArgsSchema,
        { workProjectId: 'wp1', itemType: 'chapter', parentId: 'tale-1', itemId: 'ch-1' },
        ['workProjectId', 'parentId', 'itemId'],
      ],
      [
        'auditionMedia workPrompt',
        AuditionMediaPublicationArgsSchema,
        workPrompt,
        ['userId', 'auditionId', 'workProjectId'],
      ],
      [
        'auditionMedia adminPrompt',
        AuditionMediaPublicationArgsSchema,
        adminPrompt,
        ['userId', 'auditionId'],
      ],
      [
        'auditionMedia entry',
        AuditionMediaPublicationArgsSchema,
        entry,
        ['userId', 'auditionId', 'auditionEntryId'],
      ],
      [
        'commissionListingMedia',
        CommissionListingMediaPublicationArgsSchema,
        commissionListing,
        ['commissionListingId', 'userId'],
      ],
      [
        'commissionProposalMedia',
        CommissionProposalMediaPublicationArgsSchema,
        commissionProposal,
        ['commissionListingId', 'userId'],
      ],
      [
        'craftSkillMedia',
        CraftSkillMediaPublicationArgsSchema,
        craftSkill,
        ['userId', 'craftSkillId'],
      ],
      [
        'conversationFile',
        ConversationFilePublicationArgsSchema,
        conversationFile,
        ['conversationFileId', 'uploadedByUid'],
      ],
    ];
    for (const [kind, schema, valid, fields] of idFields) {
      expect(schema.safeParse(valid).success, kind).toBe(true);
      for (const field of fields) {
        for (const id of notOneSegment) {
          expect(
            schema.safeParse({ ...valid, [field]: id }).success,
            `${kind}.${field} = ${JSON.stringify(id).slice(0, 20)}`,
          ).toBe(false);
        }
      }
    }
    for (const id of notOneSegment) {
      expect(
        CommissionListingMediaPublicationArgsSchema.safeParse({
          ...commissionListing,
          workProjectAssociatedWith: { workProjectId: id, type: 'tale' },
        }).success,
        `workProjectAssociatedWith.workProjectId = ${JSON.stringify(id).slice(0, 20)}`,
      ).toBe(false);
    }
  });

  it('a profile picture job carries only its account; a stored superseded-asset id is refused', () => {
    expect(ProfilePicturePublicationArgsSchema.safeParse({ userId: 'u1' }).success).toBe(true);
    expect(
      ProfilePicturePublicationArgsSchema.safeParse({ userId: 'u1', previousAssetId: 'asset-0' })
        .success,
    ).toBe(false);
  });
});

describe('hall publication args address a surface by name', () => {
  it('a cover names a detail surface, never a sub-item surface', () => {
    for (const itemType of ['tale', 'tune', 'television']) {
      expect(
        HallCoverPublicationArgsSchema.safeParse({ workProjectId: 'wp1', itemType, itemId: 'i1' })
          .success,
        itemType,
      ).toBe(true);
    }
    expect(
      HallCoverPublicationArgsSchema.safeParse({
        workProjectId: 'wp1',
        itemType: 'chapter',
        itemId: 'i1',
      }).success,
    ).toBe(false);
  });

  it('sub-item media names a sub-item surface, never a detail surface or an unknown one', () => {
    const args = (itemType: string) => ({
      workProjectId: 'wp1',
      itemType,
      parentId: 'p1',
      itemId: 'i1',
    });
    for (const itemType of ['chapter', 'tuneTrack', 'televisionEpisode']) {
      expect(
        WorkContentMediaPublicationArgsSchema.safeParse(args(itemType)).success,
        itemType,
      ).toBe(true);
    }
    for (const itemType of ['tale', 'tuneSong', '']) {
      expect(
        WorkContentMediaPublicationArgsSchema.safeParse(args(itemType)).success,
        itemType,
      ).toBe(false);
    }
  });
});

describe('audition publication args', () => {
  it('a job is a work prompt, an admin prompt, or an entry — nothing else', () => {
    expect(AuditionMediaPublicationArgsSchema.safeParse(workPrompt).success).toBe(true);
    expect(AuditionMediaPublicationArgsSchema.safeParse(adminPrompt).success).toBe(true);
    expect(AuditionMediaPublicationArgsSchema.safeParse(entry).success).toBe(true);
    expect(
      AuditionMediaPublicationArgsSchema.safeParse({ mode: 'bogus', userId: 'u1' }).success,
    ).toBe(false);
  });

  it('an admin prompt is a platform or sponsored audition, never a Work audition', () => {
    expect(
      AuditionMediaPublicationArgsSchema.safeParse({
        ...adminPrompt,
        auditionType: 'sponsoredAudition',
        sponsoredAuditionAmountUSD: 100,
      }).success,
    ).toBe(true);
    expect(
      AuditionMediaPublicationArgsSchema.safeParse({ ...adminPrompt, auditionType: 'workAudition' })
        .success,
    ).toBe(false);
  });

  it('a prompt may carry the open or curated audition mode with its option count', () => {
    expect(
      AuditionMediaPublicationArgsSchema.safeParse({
        ...workPrompt,
        auditionMode: 'curated',
        expectedOptionCount: 3,
      }).success,
    ).toBe(true);
    expect(
      AuditionMediaPublicationArgsSchema.safeParse({ ...adminPrompt, auditionMode: 'open' })
        .success,
    ).toBe(true);
    expect(
      AuditionMediaPublicationArgsSchema.safeParse({ ...workPrompt, auditionMode: 'closed' })
        .success,
    ).toBe(false);
  });

  it('prompt text its declaration would refuse still parses, so the publish can end it terminally', () => {
    expect(
      AuditionMediaPublicationArgsSchema.safeParse({
        ...adminPrompt,
        title: '  A prompt  ',
        description: '   ',
      }).success,
    ).toBe(true);
  });
});

describe('square post publication args', () => {
  it('a caption its declaration would refuse still parses, so the publish can end it terminally', () => {
    expect(
      SquarePostMediaPublicationArgsSchema.safeParse({
        ...squarePost,
        content: '   ',
        mentions: [],
      }).success,
    ).toBe(true);
  });

  it('a post carries image, video, or audio media only', () => {
    expect(
      SquarePostMediaPublicationArgsSchema.safeParse({ ...squarePost, mediaType: 'other' }).success,
    ).toBe(false);
  });

  it('a placeholder named twice in the mention list is refused', () => {
    const twice = [
      { placeholder: '@m1', type: 'user', id: 'u2' },
      { placeholder: '@m1', type: 'user', id: 'u3' },
    ];
    expect(
      SquarePostMediaPublicationArgsSchema.safeParse({ ...squarePost, mentions: twice }).success,
    ).toBe(false);
  });
});

describe('craft skill publication args', () => {
  it('a craft carries at least one and at most the maximum allowlisted tags', () => {
    expect(
      CraftSkillMediaPublicationArgsSchema.safeParse({ ...craftSkill, tags: [] }).success,
    ).toBe(false);
    const max = CRAFT_SKILL_TAG_VALUES.slice(0, MAX_CRAFT_SKILL_TAGS);
    expect(
      CraftSkillMediaPublicationArgsSchema.safeParse({ ...craftSkill, tags: max }).success,
    ).toBe(true);
    const over = CRAFT_SKILL_TAG_VALUES.slice(0, MAX_CRAFT_SKILL_TAGS + 1);
    expect(
      CraftSkillMediaPublicationArgsSchema.safeParse({ ...craftSkill, tags: over }).success,
    ).toBe(false);
    expect(
      CraftSkillMediaPublicationArgsSchema.safeParse({ ...craftSkill, tags: ['not-a-tag'] })
        .success,
    ).toBe(false);
  });

  it('a craft is image, video, or audio media', () => {
    expect(
      CraftSkillMediaPublicationArgsSchema.safeParse({ ...craftSkill, skillType: 'other' }).success,
    ).toBe(false);
  });

  it('a TTT mimic carries its source reference', () => {
    expect(
      CraftSkillMediaPublicationArgsSchema.safeParse({
        ...craftSkill,
        kind: 'mimicOnTtt',
        attestation: { ...craftSkill.attestation, statementKind: 'mimicOnTtt' },
        source: { type: 'user', id: 'u9' },
      }).success,
    ).toBe(true);
  });
});

describe('work file and conversation file publication args', () => {
  it('a work file names its inspected kind and a whole, non-negative size', () => {
    const { mediaKind: _omit, ...withoutKind } = workAsset;
    expect(WorkAssetPublicationArgsSchema.safeParse(withoutKind).success).toBe(false);
    expect(WorkAssetPublicationArgsSchema.safeParse({ ...workAsset, size: -1 }).success).toBe(
      false,
    );
    expect(WorkAssetPublicationArgsSchema.safeParse({ ...workAsset, size: 1.5 }).success).toBe(
      false,
    );
  });

  it('a conversation file belongs to a guild invite or a support thread only', () => {
    expect(
      ConversationFilePublicationArgsSchema.safeParse({
        ...conversationFile,
        conversation: { kind: 'guildInvite', guildInviteId: 'inv-1' },
      }).success,
    ).toBe(true);
    expect(
      ConversationFilePublicationArgsSchema.safeParse({
        ...conversationFile,
        conversation: { kind: 'guildChannel', guildChatChannelId: 'ch-1' },
      }).success,
    ).toBe(false);
  });

  it('a conversation file job carries every field its publish writes', () => {
    expect(
      ConversationFilePublicationArgsSchema.safeParse({ conversationFileId: 'cf-1' }).success,
    ).toBe(false);
    expect(
      ConversationFilePublicationArgsSchema.safeParse({ ...conversationFile, name: '' }).success,
    ).toBe(false);
  });

  it('a conversation file reservation is a whole, non-negative byte count', () => {
    expect(
      ConversationFilePublicationArgsSchema.safeParse({ ...conversationFile, reservedBytes: 0 })
        .success,
    ).toBe(true);
    expect(
      ConversationFilePublicationArgsSchema.safeParse({ ...conversationFile, reservedBytes: -1 })
        .success,
    ).toBe(false);
    expect(
      ConversationFilePublicationArgsSchema.safeParse({ ...conversationFile, reservedBytes: 1.5 })
        .success,
    ).toBe(false);
  });
});

describe('commission publication args', () => {
  it('a listing attachment is image, video, or audio with a whole, non-negative size', () => {
    expect(
      CommissionListingMediaPublicationArgsSchema.safeParse({
        ...commissionListing,
        attachmentType: 'other',
      }).success,
    ).toBe(false);
    expect(
      CommissionListingMediaPublicationArgsSchema.safeParse({
        ...commissionListing,
        attachmentSize: -1,
      }).success,
    ).toBe(false);
  });

  it('a listing offers a whole number of stake shares', () => {
    expect(
      CommissionListingMediaPublicationArgsSchema.safeParse({
        ...commissionListing,
        postingStakeSharesOffered: 1.5,
      }).success,
    ).toBe(false);
  });

  it("a listing's Work reference is its id and type only", () => {
    expect(
      CommissionListingMediaPublicationArgsSchema.safeParse({
        ...commissionListing,
        workProjectAssociatedWith: { workProjectId: 'wp1', type: 'tale', title: 'A Work' },
      }).success,
    ).toBe(false);
  });

  it('a proposal file is image, video, or audio', () => {
    expect(
      CommissionProposalMediaPublicationArgsSchema.safeParse({
        ...commissionProposal,
        replyFileType: 'other',
      }).success,
    ).toBe(false);
  });
});

describe('system video slot publication args', () => {
  it('names a video slot, never an account slot', () => {
    expect(SystemVideoSlotPublicationArgsSchema.safeParse({ slotId: videoSlotId }).success).toBe(
      true,
    );
    expect(SystemVideoSlotPublicationArgsSchema.safeParse({ slotId: nonVideoSlotId }).success).toBe(
      false,
    );
  });
});
