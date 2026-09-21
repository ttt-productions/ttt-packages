import { describe, it, expect } from 'vitest';
import {
  DomainEventSchema,
  ProfilePictureUpdatedEventSchema,
  SquareStreetzPostCreatedEventSchema,
  ModerationViolationCreatedEventSchema,
} from '../src/media/domain-events.js';
import {
  HallLibraryCoverUpdatedEventSchema,
  HallLibrarySubItemUpdatedEventSchema,
} from '../src/media/domain-events-work.js';
import {
  HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE,
  HALL_CONTENT_DETAIL_SURFACES,
  HALL_CONTENT_SUB_ITEM_SURFACES,
} from '../src/constants/hall-content-routing.js';
import { WORK_PROJECT_TYPE_KEYS } from '../src/types/content.js';
import { HallContentTextSurfaceSchema } from '../src/doc-schemas/content.js';

describe('ProfilePictureUpdatedEventSchema', () => {
  it('parses valid event', () => {
    const event = { type: 'profile.pictureUpdated', ids: { userId: 'u_1' } };
    expect(ProfilePictureUpdatedEventSchema.parse(event).type).toBe('profile.pictureUpdated');
  });
  it('rejects missing userId', () => {
    expect(() => ProfilePictureUpdatedEventSchema.parse({ type: 'profile.pictureUpdated', ids: {} })).toThrow();
  });
});

describe('SquareStreetzPostCreatedEventSchema', () => {
  it('parses valid event', () => {
    const event = { type: 'squareStreetz.postCreated', ids: { userId: 'u_1', postId: 'p_1' } };
    expect(SquareStreetzPostCreatedEventSchema.parse(event).ids.postId).toBe('p_1');
  });
});

describe('removed chat-attachment domain event', () => {
  it('the DomainEvent union no longer accepts chat.attachmentFinalized', () => {
    expect(() =>
      DomainEventSchema.parse({
        type: 'chat.attachmentFinalized',
        ids: { guildChatMessageId: 'm_1', conversationId: 'c_1' },
      }),
    ).toThrow();
  });
});

describe('commission.closed (renamed from the commission.deleted misnomer)', () => {
  it('accepts a valid event through the union', () => {
    const result = DomainEventSchema.parse({
      type: 'commission.closed',
      ids: { commissionListingId: 'cl_1', workProjectId: 'wp_1' },
    });
    expect(result.type).toBe('commission.closed');
  });

  it('the DomainEvent union no longer accepts commission.deleted (commission deletion does not exist)', () => {
    expect(() =>
      DomainEventSchema.parse({
        type: 'commission.deleted',
        ids: { commissionListingId: 'cl_1', workProjectId: 'wp_1' },
      }),
    ).toThrow();
  });
});

describe('ModerationViolationCreatedEventSchema', () => {
  it('parses valid event with TTT fileOrigin', () => {
    const event = {
      type: 'moderation.violationCreated',
      ids: {
        userId: 'u_1',
        violationId: 'v_1',
        fileOrigin: 'profile-picture',
        pendingMediaId: 'pm_1',
      },
    };
    expect(ModerationViolationCreatedEventSchema.parse(event).ids.fileOrigin).toBe('profile-picture');
  });

  it('rejects unknown fileOrigin', () => {
    const event = {
      type: 'moderation.violationCreated',
      ids: {
        userId: 'u_1',
        violationId: 'v_1',
        fileOrigin: 'unknown-origin',
        pendingMediaId: 'pm_1',
      },
    };
    expect(() => ModerationViolationCreatedEventSchema.parse(event)).toThrow();
  });
});

describe('DomainEventSchema discriminated union', () => {
  it('accepts profile.pictureUpdated', () => {
    const result = DomainEventSchema.parse({ type: 'profile.pictureUpdated', ids: { userId: 'u_1' } });
    expect(result.type).toBe('profile.pictureUpdated');
  });

  it('accepts squareStreetz.postCreated', () => {
    const result = DomainEventSchema.parse({ type: 'squareStreetz.postCreated', ids: { userId: 'u_1', postId: 'p_1' } });
    expect(result.type).toBe('squareStreetz.postCreated');
  });

  it('rejects unknown event type', () => {
    expect(() => DomainEventSchema.parse({ type: 'bogus.event', ids: {} })).toThrow();
  });
});




describe('workRealm.coverUpdated (realm cover publication)', () => {
  it('accepts a valid event through the union', () => {
    const result = DomainEventSchema.parse({ type: 'workRealm.coverUpdated', ids: { workRealmId: 'realm_1' } });
    expect(result.type).toBe('workRealm.coverUpdated');
  });

  it('rejects a missing workRealmId', () => {
    expect(() => DomainEventSchema.parse({ type: 'workRealm.coverUpdated', ids: {} })).toThrow();
  });

  it('rejects unknown id fields (strict)', () => {
    expect(() =>
      DomainEventSchema.parse({ type: 'workRealm.coverUpdated', ids: { workRealmId: 'realm_1', extra: 'x' } }),
    ).toThrow();
  });
});

describe('profile.displayNameChanged (self-service display-name set)', () => {
  it('accepts a valid event through the union', () => {
    const result = DomainEventSchema.parse({
      type: 'profile.displayNameChanged',
      ids: { userId: 'u_1' },
    });
    expect(result.type).toBe('profile.displayNameChanged');
  });

  it('rejects a missing userId', () => {
    expect(() => DomainEventSchema.parse({ type: 'profile.displayNameChanged', ids: {} })).toThrow();
  });

  it('rejects unknown id fields (strict)', () => {
    expect(() =>
      DomainEventSchema.parse({
        type: 'profile.displayNameChanged',
        ids: { userId: 'u_1', displayName: 'Stored Name' },
      }),
    ).toThrow();
  });
});

describe('admin.displayNameResetForced (admin-forced display-name reset)', () => {
  it('accepts a valid event through the union', () => {
    const result = DomainEventSchema.parse({
      type: 'admin.displayNameResetForced',
      ids: { userId: 'u_1' },
    });
    expect(result.type).toBe('admin.displayNameResetForced');
  });

  it('rejects a missing userId', () => {
    expect(() =>
      DomainEventSchema.parse({ type: 'admin.displayNameResetForced', ids: {} }),
    ).toThrow();
  });

  it('is a distinct variant from the self-service change', () => {
    const admin = DomainEventSchema.parse({
      type: 'admin.displayNameResetForced',
      ids: { userId: 'u_1' },
    });
    const self = DomainEventSchema.parse({
      type: 'profile.displayNameChanged',
      ids: { userId: 'u_1' },
    });
    expect(admin.type).not.toBe(self.type);
  });
});

describe('workRealm.detailsUpdated (realm details edit)', () => {
  it('accepts a valid event through the union', () => {
    const result = DomainEventSchema.parse({
      type: 'workRealm.detailsUpdated',
      ids: { workRealmId: 'realm_1' },
    });
    expect(result.type).toBe('workRealm.detailsUpdated');
  });

  it('rejects a missing workRealmId', () => {
    expect(() => DomainEventSchema.parse({ type: 'workRealm.detailsUpdated', ids: {} })).toThrow();
  });

  it('rejects unknown id fields (strict)', () => {
    expect(() =>
      DomainEventSchema.parse({
        type: 'workRealm.detailsUpdated',
        ids: { workRealmId: 'realm_1', workProjectId: 'wp_1' },
      }),
    ).toThrow();
  });
});

describe('hallContentChangeRequest.approved (approval only — a denial writes nothing)', () => {
  it('accepts the hall grain: workProjectId alone', () => {
    const result = DomainEventSchema.parse({
      type: 'hallContentChangeRequest.approved',
      ids: { workProjectId: 'wp_1' },
    });
    expect(result.type).toBe('hallContentChangeRequest.approved');
    expect(result.ids).toEqual({ workProjectId: 'wp_1' });
  });

  it('accepts the realm grain: workProjectId + optional workRealmId', () => {
    const result = DomainEventSchema.parse({
      type: 'hallContentChangeRequest.approved',
      ids: { workProjectId: 'wp_1', workRealmId: 'realm_1' },
    });
    expect(result.ids).toEqual({ workProjectId: 'wp_1', workRealmId: 'realm_1' });
  });

  it('rejects a missing workProjectId — every grain carries the owning work', () => {
    expect(() =>
      DomainEventSchema.parse({
        type: 'hallContentChangeRequest.approved',
        ids: { workRealmId: 'realm_1' },
      }),
    ).toThrow();
  });

  it('rejects an empty workRealmId', () => {
    expect(() =>
      DomainEventSchema.parse({
        type: 'hallContentChangeRequest.approved',
        ids: { workProjectId: 'wp_1', workRealmId: '' },
      }),
    ).toThrow();
  });

  it('has no denial twin — the union carries approval only', () => {
    expect(() =>
      DomainEventSchema.parse({
        type: 'hallContentChangeRequest.denied',
        ids: { workProjectId: 'wp_1' },
      }),
    ).toThrow();
  });
});


describe('workProject.published carries the released Realm when publication touched it', () => {
  it('accepts the work grain: workProjectId + userId', () => {
    const result = DomainEventSchema.parse({
      type: 'workProject.published',
      ids: { workProjectId: 'wp_1', userId: 'u_1' },
    });
    expect(result.ids).toEqual({ workProjectId: 'wp_1', userId: 'u_1' });
  });

  it('accepts the optional workRealmId', () => {
    const result = DomainEventSchema.parse({
      type: 'workProject.published',
      ids: { workProjectId: 'wp_1', userId: 'u_1', workRealmId: 'realm_1' },
    });
    expect(result.ids).toEqual({ workProjectId: 'wp_1', userId: 'u_1', workRealmId: 'realm_1' });
  });

  it('rejects an empty workRealmId', () => {
    expect(() =>
      DomainEventSchema.parse({
        type: 'workProject.published',
        ids: { workProjectId: 'wp_1', userId: 'u_1', workRealmId: '' },
      }),
    ).toThrow();
  });
});


// ---------------------------------------------------------------------------
// ENG-005 / ARCH-102 — the hall-library event surface enums DERIVE from the
// canonical HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE owner, so a new
// WorkProjectType cannot leave a domain event carrying a stale vocabulary.
// ---------------------------------------------------------------------------

describe('hallLibrary event itemType enums equal the canonical surface projections', () => {
  const detailProjection = WORK_PROJECT_TYPE_KEYS.map(
    (type) => HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE[type].detailSurface,
  );
  const subItemProjection = WORK_PROJECT_TYPE_KEYS.map(
    (type) => HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE[type].subItemSurface,
  );

  it('the projected tuples cover every work type exactly once', () => {
    expect([...HALL_CONTENT_DETAIL_SURFACES].sort()).toEqual([...detailProjection].sort());
    expect([...HALL_CONTENT_SUB_ITEM_SURFACES].sort()).toEqual([...subItemProjection].sort());
  });

  it('hallLibrary.coverUpdated accepts exactly the detail surfaces', () => {
    const options = HallLibraryCoverUpdatedEventSchema.shape.ids.shape.itemType.options;
    expect([...options].sort()).toEqual([...detailProjection].sort());
  });

  it('hallLibrary.subItemUpdated accepts exactly the sub-item surfaces', () => {
    const options = HallLibrarySubItemUpdatedEventSchema.shape.ids.shape.itemType.options;
    expect([...options].sort()).toEqual([...subItemProjection].sort());
  });

  it('parses a canonical detail surface and rejects a sub-item one', () => {
    const ids = {
      workProjectId: 'wp_1',
      itemType: HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tales.detailSurface,
      itemId: 'tale_1',
    };
    expect(DomainEventSchema.parse({ type: 'hallLibrary.coverUpdated', ids }).ids).toEqual(ids);
    expect(() =>
      DomainEventSchema.parse({
        type: 'hallLibrary.coverUpdated',
        ids: { ...ids, itemType: HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tales.subItemSurface },
      }),
    ).toThrow();
  });

  it('parses a canonical sub-item surface and rejects a detail one', () => {
    const ids = {
      workProjectId: 'wp_1',
      itemType: HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tunes.subItemSurface,
      parentId: 'tune_1',
      itemId: 'track_1',
    };
    expect(DomainEventSchema.parse({ type: 'hallLibrary.subItemUpdated', ids }).ids).toEqual(ids);
    expect(() =>
      DomainEventSchema.parse({
        type: 'hallLibrary.subItemUpdated',
        ids: { ...ids, itemType: HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tunes.detailSurface },
      }),
    ).toThrow();
  });

  it('the hall text-surface schema still carries every canonical surface plus the realm grain', () => {
    expect([...HallContentTextSurfaceSchema.options].sort()).toEqual(
      [...detailProjection, ...subItemProjection, 'workRealm'].sort(),
    );
  });
});
