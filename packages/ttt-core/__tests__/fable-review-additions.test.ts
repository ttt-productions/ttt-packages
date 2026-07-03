// Coverage for the batched fable-review campaign additions to ttt-core: the moderation
// text-clear per-field flags + hiddenBy marker on the content family, the guild-chat channel
// delete marker/enum, the curated-audition 'closed' status, the moderation-cascade 'mediaAsset'
// entity type, the backend-only statusReconcileQueue doc, and the AdminTaskType additions.

import { describe, it, expect } from 'vitest';
import {
  PublishedHallItemSchema,
  PublishedTuneTrackSchema,
  PublishedChapterSchema,
  PublishedTelevisionEpisodeSchema,
  FullTaleSchema,
  FullChapterSchema,
} from '../src/doc-schemas/content';
import { GuildChatChannelSchema } from '../src/doc-schemas/messaging';
import { AuditionSchema } from '../src/doc-schemas/commissions';
import { ModerationCascadeChangedEntityTypeSchema } from '../src/doc-schemas/moderation';
import { StatusReconcileQueueEntrySchema } from '../src/doc-schemas/operational';
import { AdminTaskTypeSchema } from '../src/doc-schemas/report-docs';
import { FullWorkProjectSchema, WorkRealmSchema } from '../src/doc-schemas/work-project';

describe('hiddenBy marker on published projections', () => {
  const bases = {
    PublishedTuneTrack: {
      schema: PublishedTuneTrackSchema,
      valid: { uid: 't1', title: 'T', order: 0, audioAssetId: 'a1', hidden: true },
    },
    PublishedChapter: {
      schema: PublishedChapterSchema,
      valid: { uid: 'c1', title: 'C', order: 0, content: 'body', hidden: true },
    },
    PublishedTelevisionEpisode: {
      schema: PublishedTelevisionEpisodeSchema,
      valid: { uid: 'e1', title: 'E', order: 0, videoAssetId: 'v1', hidden: true },
    },
  };

  for (const [name, { schema, valid }] of Object.entries(bases)) {
    it(`${name} accepts hiddenBy 'direct' and 'cascade' and is optional`, () => {
      expect(schema.safeParse(valid).success).toBe(true); // absent OK
      expect(schema.safeParse({ ...valid, hiddenBy: 'direct' }).success).toBe(true);
      expect(schema.safeParse({ ...valid, hiddenBy: 'cascade' }).success).toBe(true);
      expect(schema.safeParse({ ...valid, hiddenBy: 'parent' }).success).toBe(false);
    });
  }

  it('PublishedHallItem accepts hiddenBy + moderationClearedFields', () => {
    const valid = {
      hallItemId: 'h1',
      workProjectId: 'wp1',
      workProjectType: 'Tales',
      status: 'published',
      createdOn: 1,
      hallWingType: 'entertainment',
      hidden: true,
    };
    expect(
      PublishedHallItemSchema.safeParse({
        ...valid,
        hiddenBy: 'cascade',
        moderationClearedFields: ['title', 'description'],
        moderationClearedReason: 'abusive title',
      }).success,
    ).toBe(true);
  });
});

describe('per-field moderation text-clear flags (uniform shape across the family)', () => {
  it('are optional on the live content detail + sub-item schemas', () => {
    const tale = { uid: 't1', title: 'T', description: 'D', createdOn: 1 };
    expect(FullTaleSchema.safeParse(tale).success).toBe(true);
    expect(
      FullTaleSchema.safeParse({ ...tale, moderationClearedFields: ['title'], moderationClearedReason: 'x' }).success,
    ).toBe(true);

    const chapter = { uid: 'c1', title: 'C', content: 'b', description: 'D', order: 0, status: 'published', createdOn: 1 };
    expect(FullChapterSchema.safeParse(chapter).success).toBe(true);
    expect(FullChapterSchema.safeParse({ ...chapter, moderationClearedFields: [] }).success).toBe(true);
  });

  it('coexist with the existing retitle flags on workProject + workRealm', () => {
    const wp = {
      workProjectId: 'wp1',
      createdOn: 1,
      type: 'Tales',
      workingDescription: 'D',
      workingTitle: 'T',
      hallWingType: 'entertainment',
      createdBy: { uid: 'u1' },
      status: 'open',
      workRealmId: 'wr1',
      realmCanonStatus: 'canon',
      moderationRetitleRequired: true,
      moderationRetitleReason: 'r',
      moderationClearedFields: ['workingTitle'],
      moderationClearedReason: 'r',
    };
    expect(FullWorkProjectSchema.safeParse(wp).success).toBe(true);

    const wr = {
      workRealmId: 'wr1',
      realmType: 'public',
      realmStatus: 'draft',
      realmHidden: false,
      workingTitle: 'T',
      workingTitle_lowercase: 't',
      workingDescription: 'D',
      workStewardUid: 'u1',
      foundingArtisanUid: 'u1',
      foundingWorkProjectId: 'wp1',
      createdOn: 1,
      updatedOn: 1,
      moderationClearedFields: ['workingTitle', 'workingDescription'],
      moderationClearedReason: 'r',
    };
    expect(WorkRealmSchema.safeParse(wr).success).toBe(true);
  });
});

describe('GuildChatChannel delete marker', () => {
  const valid = {
    guildChatChannelId: 'ch1',
    workProjectId: 'wp1',
    channelName: 'general',
    requiredGuildStandings: [],
    allowedUserIds: [],
    createdAt: 1,
    createdBy: 'u1',
    messageCount: 0,
    isArchived: false,
  };

  it('isDeleted is an optional boolean, coherent alongside isArchived', () => {
    expect(GuildChatChannelSchema.safeParse(valid).success).toBe(true); // absent OK
    expect(GuildChatChannelSchema.safeParse({ ...valid, isDeleted: true }).success).toBe(true);
    expect(GuildChatChannelSchema.safeParse({ ...valid, isDeleted: 'yes' }).success).toBe(false);
  });
});

describe('curated audition assembly status', () => {
  it("includes the new 'closed' terminal state", () => {
    const audition = {
      auditionId: 'a1',
      type: 'workAudition',
      title: 'T',
      description: 'D',
      videoAssetId: 'v1',
      openTill: 2,
      createdOn: 1,
      createdBy: { uid: 'u1' },
      status: 'closed',
      hidden: false,
      curatedAssemblyStatus: 'closed',
    };
    expect(AuditionSchema.safeParse(audition).success).toBe(true);
    expect(AuditionSchema.safeParse({ ...audition, curatedAssemblyStatus: 'bogus' }).success).toBe(false);
  });
});

describe('ModerationCascadeChangedEntityType', () => {
  it("includes 'mediaAsset'", () => {
    expect(ModerationCascadeChangedEntityTypeSchema.safeParse('mediaAsset').success).toBe(true);
  });
});

describe('StatusReconcileQueueEntrySchema (backend-only)', () => {
  const valid = {
    uid: 'u1',
    enqueuedAt: 1,
    attemptCount: 0,
    targetStatus: 'suspended' as const,
    reason: 'postCommitAuthEffectFailed' as const,
  };

  it('accepts a minimal entry and an entry with lastAttemptAt', () => {
    expect(StatusReconcileQueueEntrySchema.safeParse(valid).success).toBe(true);
    expect(StatusReconcileQueueEntrySchema.safeParse({ ...valid, lastAttemptAt: 5 }).success).toBe(true);
  });

  it('pins reason to the literal and constrains targetStatus', () => {
    expect(StatusReconcileQueueEntrySchema.safeParse({ ...valid, reason: 'other' }).success).toBe(false);
    expect(StatusReconcileQueueEntrySchema.safeParse({ ...valid, targetStatus: 'deleted' }).success).toBe(false);
  });
});

describe('AdminTaskType additions', () => {
  it('includes pledgeDisputeOpened and pledgeRefundRequested', () => {
    expect(AdminTaskTypeSchema.safeParse('pledgeDisputeOpened').success).toBe(true);
    expect(AdminTaskTypeSchema.safeParse('pledgeRefundRequested').success).toBe(true);
  });
});
