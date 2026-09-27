import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import {
  MODERATION_HIDE_TARGET_TYPES,
  MODERATION_PARENT_KEYED_TARGET_TYPES,
  isModerationParentKeyedTargetType,
  ModerationCascadeActionSchema,
  ModerationCascadeChangedDocSchema,
  ModerationCascadeManifestSchema,
  ModerationDecisionNumberSchema,
  ModerationHiddenBySchema,
  moderationCascadeManifestId,
  moderationTargetKey,
} from '../src/doc-schemas/moderation';
import { ReportableItemTypeSchema } from '../src/doc-schemas/safety/foundation';
import { ReportGroupV1Schema } from '../src/doc-schemas/safety/report';
import {
  AuditionEntrySchema,
  AuditionSchema,
  CommissionProposalSchema,
  FullCommissionListingSchema,
} from '../src/doc-schemas/commissions';
import { SquareStreetzPostSchema } from '../src/doc-schemas/social';
import { CraftSkillReferenceSchema, CraftSkillSchema } from '../src/doc-schemas/user';
import { PublicWorkProjectSchema, WorkRealmSchema } from '../src/doc-schemas/work-project';
import {
  PublishedChapterSchema,
  PublishedHallItemSchema,
  PublishedTelevisionEpisodeSchema,
  PublishedTuneTrackSchema,
} from '../src/doc-schemas/content';

const entryTarget = { entityType: 'audition-entry', entityId: 'entry-1', parentEntityId: 'audition-1' } as const;
const manifest = {
  cascadeId: moderationCascadeManifestId(moderationTargetKey(entryTarget), 1),
  action: 'hide',
  entityType: 'audition-entry',
  entityId: 'entry-1',
  parentEntityId: 'audition-1',
  targetKey: moderationTargetKey(entryTarget),
  decision: 1,
  actorUid: 'admin-1',
  reason: 'Report upheld',
  createdAt: 1,
  status: 'pending',
};

const manifestFor = (entityType: (typeof MODERATION_HIDE_TARGET_TYPES)[number], action: string) => {
  const target = isModerationParentKeyedTargetType(entityType)
    ? { entityType, entityId: 'id-1', parentEntityId: 'parent-1' }
    : { entityType, entityId: 'id-1' };
  const targetKey = moderationTargetKey(target);
  return { ...manifest, ...target, parentEntityId: target.parentEntityId, action, targetKey, cascadeId: moderationCascadeManifestId(targetKey, 1) };
};

describe('the one hide mechanism — manifest', () => {
  it('records a hide or a restore of any report or Admin Tool hide target', () => {
    for (const entityType of MODERATION_HIDE_TARGET_TYPES) {
      for (const action of ModerationCascadeActionSchema.options) {
        expect(ModerationCascadeManifestSchema.safeParse(manifestFor(entityType, action)).success, entityType).toBe(true);
      }
    }
  });

  it('keys a parent-keyed target under its parent and every other target by its id alone', () => {
    const { parentEntityId: _parent, ...withoutParent } = manifest;
    expect(ModerationCascadeManifestSchema.safeParse(withoutParent).success).toBe(false);
    const asset = manifestFor('work-asset', 'hide');
    expect(ModerationCascadeManifestSchema.safeParse({ ...asset, parentEntityId: 'work-1' }).success).toBe(false);
    expect(MODERATION_PARENT_KEYED_TARGET_TYPES).toEqual([
      'audition-entry',
      'commission-proposal',
      'hall-library-sub-item',
      'craft-skill',
    ]);
  });

  it('refuses a manifest whose target key or id is not derived from its target and decision', () => {
    expect(ModerationCascadeManifestSchema.safeParse({ ...manifest, targetKey: 'other' }).success).toBe(false);
    expect(ModerationCascadeManifestSchema.safeParse({ ...manifest, cascadeId: 'random-id' }).success).toBe(false);
    expect(ModerationCascadeManifestSchema.safeParse({ ...manifest, decision: 2 }).success).toBe(false);
  });

  it('draws its targets from the report vocabulary, leaving out what is never hidden', () => {
    for (const entityType of MODERATION_HIDE_TARGET_TYPES) {
      expect(ReportableItemTypeSchema.options).toContain(entityType);
    }
    for (const notHidden of ['username', 'guild-invite-message', 'guild-chat-message']) {
      expect(ModerationCascadeManifestSchema.safeParse({ ...manifest, entityType: notHidden }).success).toBe(false);
    }
    expect(MODERATION_HIDE_TARGET_TYPES).toEqual(
      expect.arrayContaining(['audition', 'audition-entry', 'craft-skill', 'hall-library-item', 'hall-library-sub-item']),
    );
  });

  it('names every decision by number and target key', () => {
    const { decision: _decision, ...withoutDecision } = manifest;
    expect(ModerationCascadeManifestSchema.safeParse(withoutDecision).success).toBe(false);
    const { targetKey: _targetKey, ...withoutKey } = manifest;
    expect(ModerationCascadeManifestSchema.safeParse(withoutKey).success).toBe(false);
    expect(ModerationCascadeManifestSchema.safeParse({ ...manifest, decision: 0 }).success).toBe(false);
    expect(ModerationCascadeManifestSchema.safeParse({ ...manifest, decision: 1.5 }).success).toBe(false);
  });

  it('accepts only hide and restore as a manifest action', () => {
    for (const action of ['hideRealm', 'restoreRealm', 'hideWork', 'restoreWork']) {
      expect(ModerationCascadeManifestSchema.safeParse({ ...manifest, action }).success).toBe(false);
    }
  });

  it('carries the resume retry ledger', () => {
    expect(
      ModerationCascadeManifestSchema.safeParse({
        ...manifest,
        status: 'failed',
        attemptCount: 3,
        nextAttemptAt: 10,
        lastError: 'edge write failed',
      }).success,
    ).toBe(true);
    expect(ModerationCascadeManifestSchema.safeParse({ ...manifest, attemptCount: -1 }).success).toBe(false);
  });
});

describe('the one hide mechanism — target key and manifest id', () => {
  it('tells apart two targets whose ids match under different parents', () => {
    const other = { ...entryTarget, parentEntityId: 'audition-2' };
    expect(moderationTargetKey(entryTarget)).not.toBe(moderationTargetKey(other));
    expect(moderationTargetKey({ entityType: 'work-realm', entityId: 'r1' })).not.toBe(
      moderationTargetKey({ entityType: 'work-project', entityId: 'r1' }),
    );
  });

  it('never gives two targets one key, whatever their ids contain', () => {
    expect(moderationTargetKey({ entityType: 'audition-entry', parentEntityId: 'a~b', entityId: 'c' })).not.toBe(
      moderationTargetKey({ entityType: 'audition-entry', parentEntityId: 'a', entityId: 'b~c' }),
    );
    expect(moderationTargetKey({ entityType: 'audition-entry', parentEntityId: 'a:1', entityId: 'b' })).not.toBe(
      moderationTargetKey({ entityType: 'audition-entry', parentEntityId: 'a', entityId: '1:b' }),
    );
  });

  it('throws for a parent-keyed target without its parent, and for a parent on any other target', () => {
    expect(() => moderationTargetKey({ entityType: 'hall-library-sub-item', entityId: 's1' })).toThrow();
    expect(() => moderationTargetKey({ entityType: 'conversation-file', entityId: 'm1', parentEntityId: 'f1' })).toThrow();
  });

  it('gives each decision on one target one deterministic manifest id', () => {
    const key = moderationTargetKey(entryTarget);
    expect(moderationCascadeManifestId(key, 2)).toBe(moderationCascadeManifestId(key, 2));
    expect(moderationCascadeManifestId(key, 2)).not.toBe(moderationCascadeManifestId(key, 3));
    expect(moderationCascadeManifestId(key, 2)).not.toContain('/');
  });
});

describe('the one hide mechanism — changed docs', () => {
  const changed = {
    docPath: 'auditionBoard/audition-1/auditionEntries/entry-1',
    entityType: 'auditionEntry',
    fieldPath: 'hidden',
    previousValue: false,
    newValue: true,
    restored: false,
  };

  it('records a change on every kind of document a hide reaches', () => {
    for (const entityType of [
      'auditionEntry',
      'audition',
      'squareStreetzPost',
      'craftSkill',
      'craftSkillReference',
      'commissionListing',
      'commissionProposal',
      'hallItem',
      'subItemProjection',
      'mediaAsset',
    ]) {
      expect(ModerationCascadeChangedDocSchema.safeParse({ ...changed, entityType }).success).toBe(true);
    }
  });

  it('names the owner key its hide blocked, so the restore clears exactly that', () => {
    expect(
      ModerationCascadeChangedDocSchema.safeParse({
        ...changed,
        edgeSyncOwnerType: 'auditionEntry',
        edgeSyncOwnerId: 'audition-1:entry-1',
        edgeSyncAssetIds: ['video-1'],
      }).success,
    ).toBe(true);
    expect(ModerationCascadeChangedDocSchema.safeParse({ ...changed, edgeSyncOwnerType: 'notAnOwner' }).success).toBe(
      false,
    );
  });
});

describe('hide provenance stamps', () => {
  const stamped: Array<[string, z.ZodType]> = [
    ['Audition', (AuditionSchema.shape as Record<string, z.ZodType>).hiddenBy],
    ['AuditionEntry', (AuditionEntrySchema.shape as Record<string, z.ZodType>).hiddenBy],
    ['CommissionListing', (FullCommissionListingSchema.shape as Record<string, z.ZodType>).hiddenBy],
    ['CommissionProposal', (CommissionProposalSchema.shape as Record<string, z.ZodType>).hiddenBy],
    ['SquareStreetzPost', (SquareStreetzPostSchema.shape as Record<string, z.ZodType>).hiddenBy],
    ['CraftSkillReference', (CraftSkillReferenceSchema.shape as Record<string, z.ZodType>).hiddenBy],
    ['PublicWorkProject', (PublicWorkProjectSchema.shape as Record<string, z.ZodType>).publicWorkHiddenBy],
    ['WorkRealm', (WorkRealmSchema.shape as Record<string, z.ZodType>).realmHiddenBy],
    ['PublishedHallItem', (PublishedHallItemSchema.shape as Record<string, z.ZodType>).hiddenBy],
    ['PublishedChapter', (PublishedChapterSchema.shape as Record<string, z.ZodType>).hiddenBy],
    ['PublishedTuneTrack', (PublishedTuneTrackSchema.shape as Record<string, z.ZodType>).hiddenBy],
    ['PublishedTelevisionEpisode', (PublishedTelevisionEpisodeSchema.shape as Record<string, z.ZodType>).hiddenBy],
    ...CraftSkillSchema.options.map(
      (option) => [`CraftSkill ${option.shape.kind.value}`, (option.shape as Record<string, z.ZodType>).hiddenBy] as [
        string,
        z.ZodType,
      ],
    ),
  ];

  it('stamps every hideable document with the one direct-or-cascade provenance, absent when not hidden', () => {
    for (const [name, field] of stamped) {
      expect(field, name).toBeDefined();
      for (const value of ModerationHiddenBySchema.options) expect(field.safeParse(value).success, name).toBe(true);
      expect(field.safeParse(undefined).success, name).toBe(true);
      expect(field.safeParse('parent').success, name).toBe(false);
    }
  });
});

describe('decision number on the per-document edge obligations', () => {
  const fields: Array<[string, z.ZodType]> = [
    ['ReportGroupV1', ReportGroupV1Schema.shape.edgeSyncDecision],
    ['PublishedChapter', (PublishedChapterSchema.shape as Record<string, z.ZodType>).edgeSyncDecision],
    ['PublishedTuneTrack', (PublishedTuneTrackSchema.shape as Record<string, z.ZodType>).edgeSyncDecision],
    [
      'PublishedTelevisionEpisode',
      (PublishedTelevisionEpisodeSchema.shape as Record<string, z.ZodType>).edgeSyncDecision,
    ],
  ];

  it('records the positive decision an open obligation belongs to', () => {
    for (const [name, field] of fields) {
      expect(field, name).toBeDefined();
      expect(field.safeParse(4).success, name).toBe(true);
      expect(field.safeParse(undefined).success, name).toBe(true);
      expect(field.safeParse(0).success, name).toBe(false);
    }
    expect(ModerationDecisionNumberSchema.safeParse(1).success).toBe(true);
  });
});
