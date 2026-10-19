import { describe, it, expect, expectTypeOf } from 'vitest';
import { GUIDE_VIDEO_DEFINITIONS, guideVideoSlotId } from '../src/system-slots/guide-videos';
import {
  SYSTEM_SLOTS,
  SystemSlotKindSchema,
  SystemVideoSlotIdSchema,
  SystemUidSlotIdSchema,
  SystemUidListSlotIdSchema,
  getSystemSlot,
  SYSTEM_SLOT_GROUPS,
  isRequiredVideoSlot,
  systemSlotsByGroup,
} from '../src/system-slots/system-slots';
import { HELP_VIDEO_DEFINITIONS, helpVideoSlotId } from '../src/system-slots/help-videos';
import { SystemContentTargetInfoSchema, parseTargetInfo } from '../src/media/target-info';
import { FileOriginSchema } from '../src/media/file-origin';
import { fileOriginRowLabel } from '../src/media/upload-tray-display';
import { DomainEventSchema } from '../src/media/domain-events';
import { ClearSystemVideoSlotInputSchema, UpdateSystemUidSlotInputSchema } from '../src/schemas/admin';
import { MAX_SYSTEM_UID_LIST } from '../src/constants/business-admin';
import {
  UploadSystemContentVariablesSchema,
} from '../src/upload-variables/upload-system-content-variables';
import {
  EMPTY_SYSTEM_VIDEO_SLOTS_DOCUMENT,
  SystemUidSlotsDocumentSchema,
  SystemVideoSlotsDocumentSchema,
} from '../src/doc-schemas/system-slots';
import { MediaAssetOwnerTypeSchema, MediaPublicationKindSchema } from '../src/doc-schemas/media-assets';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry';
import { PATH_BUILDERS } from '../src/paths/path-builders';
import { COLLECTIONS } from '../src/paths/collections';
import type { AuditEventType } from '../src/types/audit';

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('the system-slot registry', () => {
  it('gives every slot a unique id', () => {
    const ids = SYSTEM_SLOTS.map((slot) => slot.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('writes every id in kebab-case', () => {
    for (const slot of SYSTEM_SLOTS) expect(slot.id, slot.id).toMatch(KEBAB_CASE);
  });

  it('gives every slot a valid kind, a label, and a description', () => {
    for (const slot of SYSTEM_SLOTS) {
      expect(SystemSlotKindSchema.safeParse(slot.kind).success, slot.id).toBe(true);
      expect(slot.label.trim().length, slot.id).toBeGreaterThan(0);
      expect(slot.description.trim().length, slot.id).toBeGreaterThan(0);
    }
  });

  it('holds the founder, team, and landing-hero slots with their kinds', () => {
    expect(getSystemSlot('founder')?.kind).toBe('uid');
    expect(getSystemSlot('team')?.kind).toBe('uidList');
    expect(getSystemSlot('landing-hero')?.kind).toBe('video');
  });

  it('answers undefined for an id the registry does not hold', () => {
    expect(getSystemSlot('not-a-slot')).toBeUndefined();
  });

  it('derives one video slot per Guide video, titled with its planned title', () => {
    for (const video of GUIDE_VIDEO_DEFINITIONS) {
      const slot = getSystemSlot(guideVideoSlotId(video.id));
      expect(slot, video.id).toEqual(expect.objectContaining({ kind: 'video', label: video.plannedTitle }));
    }
  });

  it('holds no Guide slot that a Guide video does not declare', () => {
    const declared = new Set<string>(GUIDE_VIDEO_DEFINITIONS.map((video) => guideVideoSlotId(video.id)));
    const guideSlots = SYSTEM_SLOTS.filter((slot) => slot.id.startsWith('guide-'));
    for (const slot of guideSlots) expect(declared.has(slot.id), slot.id).toBe(true);
    expect(guideSlots).toHaveLength(GUIDE_VIDEO_DEFINITIONS.length);
  });

  it('declares each Guide video once', () => {
    const ids = GUIDE_VIDEO_DEFINITIONS.map((video) => video.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('builds a Guide slot id from the video id', () => {
    expect(guideVideoSlotId('ttt-in-five-minutes')).toBe('guide-ttt-in-five-minutes');
  });

  it('splits the slot ids by kind', () => {
    const idsOf = (kind: string) => SYSTEM_SLOTS.filter((slot) => slot.kind === kind).map((slot) => slot.id);
    expect([...SystemVideoSlotIdSchema.options]).toEqual(idsOf('video'));
    expect([...SystemUidSlotIdSchema.options]).toEqual(idsOf('uid'));
    expect([...SystemUidListSlotIdSchema.options]).toEqual(idsOf('uidList'));
  });
});

describe('the system-slot groups and required videos', () => {
  const groupIds: readonly string[] = SYSTEM_SLOT_GROUPS.map((group) => group.id);

  it('puts every slot in a declared group', () => {
    for (const slot of SYSTEM_SLOTS) expect(groupIds, slot.id).toContain(slot.group);
  });

  it('declares every group once, with a name, and only groups a slot belongs to', () => {
    expect(new Set(groupIds).size).toBe(groupIds.length);
    for (const group of SYSTEM_SLOT_GROUPS) {
      expect(group.label.trim().length, group.id).toBeGreaterThan(0);
      expect(SYSTEM_SLOTS.some((slot) => slot.group === group.id), group.id).toBe(true);
    }
  });

  it('declares on every video slot whether its place always shows a video', () => {
    for (const slot of SYSTEM_SLOTS) {
      if (slot.kind === 'video') expect(typeof slot.requiredVideo, slot.id).toBe('boolean');
      else expect(slot, slot.id).not.toHaveProperty('requiredVideo');
    }
  });

  it('requires a video on the landing hero and every Guide video; never on a Help placement', () => {
    expect(isRequiredVideoSlot('landing-hero')).toBe(true);
    for (const video of GUIDE_VIDEO_DEFINITIONS) expect(isRequiredVideoSlot(guideVideoSlotId(video.id)), video.id).toBe(true);
    for (const help of HELP_VIDEO_DEFINITIONS) expect(isRequiredVideoSlot(helpVideoSlotId(help.id)), help.id).toBe(false);
  });

  it('lists the slots under their groups, in the groups\' order, every slot once', () => {
    const grouped = systemSlotsByGroup();
    expect(grouped.map((entry) => entry.group.id)).toEqual(groupIds);
    expect(grouped.flatMap((entry) => entry.slots.map((slot) => slot.id)).sort()).toEqual(SYSTEM_SLOTS.map((slot) => slot.id).sort());
    for (const entry of grouped) for (const slot of entry.slots) expect(slot.group).toBe(entry.group.id);
  });

  it('keeps each grouped slot typed as its registry entry, so its id stays a slot id of its kind', () => {
    const slot = systemSlotsByGroup()[0].slots[0];
    expectTypeOf(slot.id).toEqualTypeOf<(typeof SYSTEM_SLOTS)[number]['id']>();
    expectTypeOf(slot).toEqualTypeOf<(typeof SYSTEM_SLOTS)[number]>();
  });
});

describe('the Help component video slots', () => {
  it('derives one optional Help-components video slot per Help placement, titled and located from it', () => {
    for (const help of HELP_VIDEO_DEFINITIONS) {
      const slot = getSystemSlot(helpVideoSlotId(help.id));
      expect(slot, help.id).toMatchObject({ kind: 'video', label: help.title, description: help.location, group: 'helpComponents', requiredVideo: false });
    }
  });

  it('holds no Help slot that a Help placement does not declare', () => {
    const declared = new Set<string>(HELP_VIDEO_DEFINITIONS.map((help) => helpVideoSlotId(help.id)));
    const helpSlots = SYSTEM_SLOTS.filter((slot) => slot.id.startsWith('help-')).map((slot) => slot.id);
    for (const id of helpSlots) expect(declared, id).toContain(id);
  });

  it('declares each Help placement once, with a kebab-case id, a title, and a location', () => {
    const ids = HELP_VIDEO_DEFINITIONS.map((help) => help.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const help of HELP_VIDEO_DEFINITIONS) {
      expect(help.id).toMatch(KEBAB_CASE);
      expect(help.title.trim().length, help.id).toBeGreaterThan(0);
      expect(help.location.trim().length, help.id).toBeGreaterThan(0);
    }
  });

  it('builds a Help slot id from the placement id', () => {
    expect(helpVideoSlotId('hall')).toBe('help-hall');
    expect(SystemVideoSlotIdSchema.safeParse('help-hall').success).toBe(true);
  });
});

describe('the system-content upload origin', () => {
  it('is a canonical file origin with a tray label', () => {
    expect(FileOriginSchema.parse('system-content')).toBe('system-content');
    expect(fileOriginRowLabel['system-content']).toBe('System video');
  });

  it('takes a video slot as its target', () => {
    expect(parseTargetInfo('system-content', { slotId: 'landing-hero' })).toEqual({ slotId: 'landing-hero' });
  });

  it('refuses a slot the registry does not hold', () => {
    expect(SystemContentTargetInfoSchema.safeParse({ slotId: 'not-a-slot' }).success).toBe(false);
  });

  it('refuses a slot that is not a video slot', () => {
    expect(SystemContentTargetInfoSchema.safeParse({ slotId: 'founder' }).success).toBe(false);
  });

  it('refuses any field beside the slot', () => {
    expect(
      SystemContentTargetInfoSchema.safeParse({ slotId: 'landing-hero', assetId: 'a1' }).success,
    ).toBe(false);
  });

  it('publishes as a systemContent-owned asset through its own publication kind', () => {
    expect(MediaAssetOwnerTypeSchema.parse('systemContent')).toBe('systemContent');
    expect(MediaPublicationKindSchema.parse('systemVideoSlot')).toBe('systemVideoSlot');
  });
});

describe('UploadSystemContentVariablesSchema', () => {
  const videoFile = new Blob(['x']);

  it('accepts a video slot and its file', () => {
    expect(UploadSystemContentVariablesSchema.safeParse({ slotId: 'landing-hero', videoFile }).success).toBe(true);
  });

  it('refuses a slot that is not a video slot', () => {
    expect(UploadSystemContentVariablesSchema.safeParse({ slotId: 'team', videoFile }).success).toBe(false);
  });

  it('refuses a missing file', () => {
    expect(UploadSystemContentVariablesSchema.safeParse({ slotId: 'landing-hero' }).success).toBe(false);
  });
});

describe('ClearSystemVideoSlotInputSchema', () => {
  it('takes only a video slot id', () => {
    expect(ClearSystemVideoSlotInputSchema.parse({ slotId: 'landing-hero' })).toEqual({ slotId: 'landing-hero' });
    expect(ClearSystemVideoSlotInputSchema.safeParse({ slotId: 'founder' }).success).toBe(false);
    expect(ClearSystemVideoSlotInputSchema.safeParse({ slotId: 'landing-hero', extra: 1 }).success).toBe(false);
  });
});

describe('the system-slot domain events', () => {
  it('carry no video-slot event: every signed-in tab reads the video slots live', () => {
    expect(DomainEventSchema.safeParse({ type: 'systemSlot.videoUpdated', ids: { slotId: 'landing-hero' } }).success).toBe(false);
  });

  it('carry a uid or uid-list slot on systemSlot.uidUpdated', () => {
    for (const slotId of ['founder', 'team']) {
      const event = { type: 'systemSlot.uidUpdated', ids: { slotId } };
      expect(DomainEventSchema.parse(event)).toEqual(event);
    }
    expect(
      DomainEventSchema.safeParse({ type: 'systemSlot.uidUpdated', ids: { slotId: 'landing-hero' } }).success,
    ).toBe(false);
  });
});

describe('the system-slot audit event types', () => {
  it('names the publish, the clear, and the account-slot update', () => {
    const types: AuditEventType[] = [
      'system.videoSlotPublished',
      'admin.videoSlotCleared',
      'admin.systemUidSlotUpdated',
    ];
    expectTypeOf(types).toEqualTypeOf<AuditEventType[]>();
  });
});

describe('SystemVideoSlotsDocumentSchema', () => {
  it('accepts the canonical empty doc', () => {
    expect(SystemVideoSlotsDocumentSchema.parse(EMPTY_SYSTEM_VIDEO_SLOTS_DOCUMENT)).toEqual({ slots: {}, version: 0 });
  });

  it('accepts a full entry, published and mid-upload', () => {
    const doc = {
      slots: {
        'landing-hero': { assetId: 'asset1', uploadPendingMediaId: null, updatedAt: 1_760_000_000_000 },
        'guide-what-is-a-work': { assetId: null, uploadPendingMediaId: 'pm1', updatedAt: 1_760_000_000_000 },
      },
      version: 3,
    };
    expect(SystemVideoSlotsDocumentSchema.parse(doc)).toEqual(doc);
  });

  it('refuses a partial entry', () => {
    expect(
      SystemVideoSlotsDocumentSchema.safeParse({
        slots: { 'landing-hero': { assetId: 'asset1', updatedAt: 1 } },
        version: 1,
      }).success,
    ).toBe(false);
  });

  it('refuses an entry for a slot that is not a video slot', () => {
    expect(
      SystemVideoSlotsDocumentSchema.safeParse({
        slots: { founder: { assetId: 'asset1', uploadPendingMediaId: null, updatedAt: 1 } },
        version: 1,
      }).success,
    ).toBe(false);
  });
});

describe('SystemUidSlotsDocumentSchema', () => {
  it('accepts a doc with no slots set', () => {
    const doc = { slots: {}, version: 0, lastUpdated: 0 };
    expect(SystemUidSlotsDocumentSchema.parse(doc)).toEqual(doc);
  });

  it('accepts one account on a uid slot and a list on a uid-list slot', () => {
    const doc = { slots: { founder: 'u1', team: ['u2', 'u3'] }, version: 2, lastUpdated: 1_760_000_000_000 };
    expect(SystemUidSlotsDocumentSchema.parse(doc)).toEqual(doc);
  });

  it('refuses a list on a uid slot', () => {
    expect(
      SystemUidSlotsDocumentSchema.safeParse({ slots: { founder: ['u1'] }, version: 1, lastUpdated: 1 }).success,
    ).toBe(false);
  });

  it('refuses a single account on a uid-list slot', () => {
    expect(
      SystemUidSlotsDocumentSchema.safeParse({ slots: { team: 'u1' }, version: 1, lastUpdated: 1 }).success,
    ).toBe(false);
  });

  it('refuses a key that is not an account slot', () => {
    expect(
      SystemUidSlotsDocumentSchema.safeParse({ slots: { 'landing-hero': 'u1' }, version: 1, lastUpdated: 1 }).success,
    ).toBe(false);
  });

  it('refuses an account id that is not one path segment', () => {
    expect(
      SystemUidSlotsDocumentSchema.safeParse({ slots: { founder: 'a/b' }, version: 1, lastUpdated: 1 }).success,
    ).toBe(false);
  });
});

describe('the system-slot singletons', () => {
  it('keeps the video slots in the signed-in bucket and the account slots in the public bucket', () => {
    expect(PATH_BUILDERS.systemVideoSlots()).toEqual([COLLECTIONS.SYSTEM_DATA, 'systemVideoSlots']);
    expect(PATH_BUILDERS.systemUidSlots()).toEqual([COLLECTIONS.APP_CONFIG, 'systemUidSlots']);
  });

  it('binds each doc to its schema in the registry', () => {
    expect(COLLECTION_SCHEMAS['_systemData/systemVideoSlots']).toBe(SystemVideoSlotsDocumentSchema);
    expect(COLLECTION_SCHEMAS['_appConfig/systemUidSlots']).toBe(SystemUidSlotsDocumentSchema);
  });
});

describe('UpdateSystemUidSlotInputSchema', () => {
  const uids = (count: number) => Array.from({ length: count }, (_, i) => `u${i}`);

  it('caps a uid-list slot at 25 accounts', () => {
    expect(MAX_SYSTEM_UID_LIST).toBe(25);
  });

  it('sets or clears a uid slot with one account id or null', () => {
    expect(UpdateSystemUidSlotInputSchema.parse({ slotId: 'founder', value: 'u1' })).toEqual({ slotId: 'founder', value: 'u1' });
    expect(UpdateSystemUidSlotInputSchema.parse({ slotId: 'founder', value: null })).toEqual({ slotId: 'founder', value: null });
  });

  it('sets or clears a uid-list slot with a list of up to 25 accounts', () => {
    expect(UpdateSystemUidSlotInputSchema.safeParse({ slotId: 'team', value: uids(25) }).success).toBe(true);
    expect(UpdateSystemUidSlotInputSchema.safeParse({ slotId: 'team', value: [] }).success).toBe(true);
  });

  it('refuses a 26-account list', () => {
    expect(UpdateSystemUidSlotInputSchema.safeParse({ slotId: 'team', value: uids(26) }).success).toBe(false);
  });

  it('refuses a value whose shape does not match the slot kind', () => {
    expect(UpdateSystemUidSlotInputSchema.safeParse({ slotId: 'founder', value: ['u1'] }).success).toBe(false);
    expect(UpdateSystemUidSlotInputSchema.safeParse({ slotId: 'team', value: 'u1' }).success).toBe(false);
    expect(UpdateSystemUidSlotInputSchema.safeParse({ slotId: 'team', value: null }).success).toBe(false);
  });

  it('refuses a video slot, a blank account id, an id with a slash, and extra fields', () => {
    expect(UpdateSystemUidSlotInputSchema.safeParse({ slotId: 'landing-hero', value: 'u1' }).success).toBe(false);
    expect(UpdateSystemUidSlotInputSchema.safeParse({ slotId: 'founder', value: '' }).success).toBe(false);
    expect(UpdateSystemUidSlotInputSchema.safeParse({ slotId: 'founder', value: 'a/b' }).success).toBe(false);
    expect(UpdateSystemUidSlotInputSchema.safeParse({ slotId: 'founder', value: 'u1', extra: 1 }).success).toBe(false);
  });
});

describe('the stored uid-list cap', () => {
  it('refuses a stored list longer than the update input allows', () => {
    const team = Array.from({ length: MAX_SYSTEM_UID_LIST + 1 }, (_, i) => `u${i}`);
    expect(SystemUidSlotsDocumentSchema.safeParse({ slots: { team }, version: 1, lastUpdated: 1 }).success).toBe(false);
    expect(
      SystemUidSlotsDocumentSchema.safeParse({ slots: { team: team.slice(1) }, version: 1, lastUpdated: 1 }).success,
    ).toBe(true);
  });
});
