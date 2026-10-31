import { describe, it, expect } from 'vitest';
import { DomainEventSchema } from '../src/media/domain-events.js';
import { ProfilePictureUpdatedEventSchema } from '../src/media/domain-events-user.js';
import { SquareStreetzPostCreatedEventSchema } from '../src/media/domain-events-social.js';
import { ModerationViolationCreatedEventSchema } from '../src/media/domain-events-admin.js';
import {
  AuditionEntrySubmittedEventSchema,
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
    expect(() =>
      ProfilePictureUpdatedEventSchema.parse({ type: 'profile.pictureUpdated', ids: {} }),
    ).toThrow();
  });
});

describe('SquareStreetzPostCreatedEventSchema', () => {
  it('parses valid event', () => {
    const event = { type: 'squareStreetz.postCreated', ids: { userId: 'u_1', postId: 'p_1' } };
    expect(SquareStreetzPostCreatedEventSchema.parse(event).ids.postId).toBe('p_1');
  });
});

describe('a like names the liker and the post, never an author (a Town Crier post has none)', () => {
  it.each(['squareStreetz.postLiked', 'squareStreetz.postUnliked'] as const)(
    '%s parses with only the liker and the post',
    (type) => {
      const event = { type, ids: { userId: 'u_1', postId: 'p_1' } };
      expect(DomainEventSchema.parse(event)).toEqual(event);
    },
  );
  it.each(['squareStreetz.postLiked', 'squareStreetz.postUnliked'] as const)(
    '%s refuses an authorId',
    (type) => {
      expect(() =>
        DomainEventSchema.parse({ type, ids: { userId: 'u_1', postId: 'p_1', authorId: 'a_1' } }),
      ).toThrow();
    },
  );
});

describe('chat attachments carry no domain event', () => {
  it('the DomainEvent union rejects chat.attachmentFinalized', () => {
    expect(() =>
      DomainEventSchema.parse({
        type: 'chat.attachmentFinalized',
        ids: { guildChatMessageId: 'm_1', conversationId: 'c_1' },
      }),
    ).toThrow();
  });
});

describe('commission.closed (closing is the one end of a listing)', () => {
  it('accepts a valid event through the union', () => {
    const result = DomainEventSchema.parse({
      type: 'commission.closed',
      ids: { commissionListingId: 'cl_1', workProjectId: 'wp_1' },
    });
    expect(result.type).toBe('commission.closed');
  });

  it('the DomainEvent union rejects commission.deleted (commission deletion does not exist)', () => {
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
    expect(ModerationViolationCreatedEventSchema.parse(event).ids.fileOrigin).toBe(
      'profile-picture',
    );
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
    const result = DomainEventSchema.parse({
      type: 'profile.pictureUpdated',
      ids: { userId: 'u_1' },
    });
    expect(result.type).toBe('profile.pictureUpdated');
  });

  it('accepts squareStreetz.postCreated', () => {
    const result = DomainEventSchema.parse({
      type: 'squareStreetz.postCreated',
      ids: { userId: 'u_1', postId: 'p_1' },
    });
    expect(result.type).toBe('squareStreetz.postCreated');
  });

  it('rejects unknown event type', () => {
    expect(() => DomainEventSchema.parse({ type: 'bogus.event', ids: {} })).toThrow();
  });
});

describe('workRealm.coverUpdated (realm cover publication)', () => {
  it('accepts a valid event through the union', () => {
    const result = DomainEventSchema.parse({
      type: 'workRealm.coverUpdated',
      ids: { workRealmId: 'realm_1' },
    });
    expect(result.type).toBe('workRealm.coverUpdated');
  });

  it('rejects a missing workRealmId', () => {
    expect(() => DomainEventSchema.parse({ type: 'workRealm.coverUpdated', ids: {} })).toThrow();
  });

  it('rejects unknown id fields (strict)', () => {
    expect(() =>
      DomainEventSchema.parse({
        type: 'workRealm.coverUpdated',
        ids: { workRealmId: 'realm_1', extra: 'x' },
      }),
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
    expect(() =>
      DomainEventSchema.parse({ type: 'profile.displayNameChanged', ids: {} }),
    ).toThrow();
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

describe('domain events nothing produces', () => {
  it('rejects adminDispatch.systemMarked — nothing produces it, so nothing may emit it', () => {
    expect(
      DomainEventSchema.safeParse({ type: 'adminDispatch.systemMarked', ids: { userId: 'u_1' } })
        .success,
    ).toBe(false);
  });

  it('still accepts the live admin-dispatch event', () => {
    expect(
      DomainEventSchema.safeParse({
        type: 'adminDispatch.threadUpdated',
        ids: { adminDispatchId: 'd_1' },
      }).success,
    ).toBe(true);
  });
});

describe('workProject.guildmateLeft (a committed departure from a Work)', () => {
  it('accepts the departed Work and the departing user through the union', () => {
    const event = { type: 'workProject.guildmateLeft', ids: { workProjectId: 'w1', userId: 'u1' } };
    expect(DomainEventSchema.parse(event)).toEqual(event);
  });

  it('rejects a missing departing user', () => {
    expect(
      DomainEventSchema.safeParse({
        type: 'workProject.guildmateLeft',
        ids: { workProjectId: 'w1' },
      }).success,
    ).toBe(false);
  });

  it('rejects unknown id fields (strict)', () => {
    expect(
      DomainEventSchema.safeParse({
        type: 'workProject.guildmateLeft',
        ids: { workProjectId: 'w1', userId: 'u1', stakeShares: 0 },
      }).success,
    ).toBe(false);
  });
});

describe('cache events with no write of their own: registration, a violation decision, an acceptance', () => {
  const events = [
    { type: 'auth.registrationCompleted', ids: { userId: 'u1' } },
    { type: 'violation.decisionAccepted', ids: { userId: 'u1', violationId: 'v1' } },
    { type: 'publicDocuments.acceptanceLanded', ids: { userId: 'u1' } },
  ];

  it('each is accepted through the union with exactly its ids', () => {
    for (const event of events) expect(DomainEventSchema.parse(event)).toEqual(event);
  });

  it('each refuses a missing id and an unknown id (strict)', () => {
    expect(
      DomainEventSchema.safeParse({ type: 'auth.registrationCompleted', ids: {} }).success,
    ).toBe(false);
    expect(
      DomainEventSchema.safeParse({ type: 'violation.decisionAccepted', ids: { userId: 'u1' } })
        .success,
    ).toBe(false);
    expect(
      DomainEventSchema.safeParse({ type: 'publicDocuments.acceptanceLanded', ids: {} }).success,
    ).toBe(false);
    for (const event of events) {
      expect(
        DomainEventSchema.safeParse({ ...event, ids: { ...event.ids, extra: 'x' } }).success,
      ).toBe(false);
    }
  });
});

describe('AuditionEntrySubmittedEventSchema', () => {
  const ids = { userId: 'u_1', auditionId: 'a_1', auditionEntryId: 'e_2' };

  it("names the entrant's earlier entry when the new entry replaces one", () => {
    const event = {
      type: 'audition.entryCreated',
      ids: { ...ids, previousAuditionEntryId: 'e_1' },
    };
    expect(AuditionEntrySubmittedEventSchema.parse(event)).toEqual(event);
  });

  it('parses a first entry, which replaces nothing', () => {
    const event = { type: 'audition.entryCreated', ids };
    expect(AuditionEntrySubmittedEventSchema.parse(event)).toEqual(event);
  });

  it('refuses an empty earlier-entry id', () => {
    expect(
      AuditionEntrySubmittedEventSchema.safeParse({
        type: 'audition.entryCreated',
        ids: { ...ids, previousAuditionEntryId: '' },
      }).success,
    ).toBe(false);
  });
});

describe('admin-tool outcomes name the entity they changed', () => {
  const cases = [
    { type: 'workRealm.hidden', ids: { workRealmId: 'r_1' } },
    { type: 'workRealm.restored', ids: { workRealmId: 'r_1' } },
    { type: 'workRealm.retitleRequired', ids: { workRealmId: 'r_1' } },
    { type: 'workRealm.textCleared', ids: { workRealmId: 'r_1' } },
    { type: 'workProject.hidden', ids: { workProjectId: 'wp_1' } },
    { type: 'workProject.restored', ids: { workProjectId: 'wp_1' } },
    { type: 'workProject.retitleRequired', ids: { workProjectId: 'wp_1' } },
    { type: 'workProject.textCleared', ids: { workProjectId: 'wp_1' } },
    { type: 'hallLibrary.subItemHidden', ids: { hallItemId: 'h_1', subItemId: 's_1' } },
    { type: 'hallLibrary.subItemRestored', ids: { hallItemId: 'h_1', subItemId: 's_1' } },
    { type: 'hallLibrary.subItemTextCleared', ids: { hallItemId: 'h_1', subItemId: 's_1' } },
  ] as const;

  it.each(cases)('the union accepts $type with its entity ids', (event) => {
    expect(DomainEventSchema.parse(event)).toEqual(event);
  });

  it.each(cases)('the union rejects $type without its entity ids', ({ type }) => {
    expect(() => DomainEventSchema.parse({ type, ids: {} })).toThrow();
  });

  it('a Hall sub-item outcome names the Hall item as well as the sub-item', () => {
    expect(() =>
      DomainEventSchema.parse({ type: 'hallLibrary.subItemHidden', ids: { subItemId: 's_1' } }),
    ).toThrow();
  });
});

describe('a guild-chat channel archive or unarchive names its Work and channel', () => {
  it.each(['guildChat.channelArchived', 'guildChat.channelUnarchived'] as const)(
    '%s parses with both ids and rejects a missing channel',
    (type) => {
      const ids = { workProjectId: 'wp_1', guildChatChannelId: 'ch_1' };
      expect(DomainEventSchema.parse({ type, ids })).toEqual({ type, ids });
      expect(() => DomainEventSchema.parse({ type, ids: { workProjectId: 'wp_1' } })).toThrow();
    },
  );
});
