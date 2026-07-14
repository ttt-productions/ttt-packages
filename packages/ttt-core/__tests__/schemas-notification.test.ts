import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  NOTIFICATION_TYPE_VALUES,
  NotificationTypeSchema,
  NotificationChannelSchema,
  NOTIFICATION_TYPE_CATALOG,
  NotificationMetadataByTypeSchema,
  BroadcastAudienceSelectorSchema,
  CreateNotificationBroadcastInputSchema,
  ArchiveNotificationInputSchema,
  MarkNotificationsSeenInputSchema,
  MarkNotificationsSeenObservedInputSchema,
  ArchiveNotificationObservedInputSchema,
  type NotificationType,
  type MarkNotificationsSeenObservedInput,
  type ArchiveNotificationObservedInput,
} from '../src/schemas/notification';
import type { AuditEventType } from '../src/types/audit';

describe('NotificationType + catalog', () => {
  it('parses every canonical type and rejects retired/unknown names', () => {
    for (const t of NOTIFICATION_TYPE_VALUES) {
      expect(NotificationTypeSchema.safeParse(t).success).toBe(true);
    }
    expect(NotificationTypeSchema.safeParse('project_invite').success).toBe(false);
    expect(NotificationTypeSchema.safeParse('library_submission').success).toBe(false);
  });

  it('includes admin_announcement', () => {
    expect(NOTIFICATION_TYPE_VALUES).toContain('admin_announcement');
    expect(NotificationTypeSchema.safeParse('admin_announcement').success).toBe(true);
  });

  it('has a catalog entry for every type with a default channel list of [inApp]', () => {
    const catalogKeys = Object.keys(NOTIFICATION_TYPE_CATALOG).sort();
    expect(catalogKeys).toEqual([...NOTIFICATION_TYPE_VALUES].sort());
    for (const t of NOTIFICATION_TYPE_VALUES) {
      expect(NOTIFICATION_TYPE_CATALOG[t].defaultChannels).toEqual(['inApp']);
    }
  });

  it('maps category + delivery per the design table', () => {
    expect(NOTIFICATION_TYPE_CATALOG.content_report).toMatchObject({ category: 'admin', delivery: 'realtime' });
    expect(NOTIFICATION_TYPE_CATALOG.guild_invite).toMatchObject({ category: 'user', delivery: 'queued' });
    expect(NOTIFICATION_TYPE_CATALOG.admin_dispatch_reply).toMatchObject({ category: 'user', delivery: 'realtime' });
    expect(NOTIFICATION_TYPE_CATALOG.threshold_library_submission).toMatchObject({ category: 'admin', delivery: 'queued' });
    expect(NOTIFICATION_TYPE_CATALOG.admin_announcement).toMatchObject({ category: 'user', delivery: 'queued' });
    expect(NOTIFICATION_TYPE_CATALOG.report_action_taken).toMatchObject({ category: 'user', delivery: 'queued' });
    expect(NOTIFICATION_TYPE_CATALOG.content_appeal_reviewed).toMatchObject({ category: 'user', delivery: 'queued' });
  });

  it('accepts the three channel values', () => {
    expect(NotificationChannelSchema.safeParse('inApp').success).toBe(true);
    expect(NotificationChannelSchema.safeParse('email').success).toBe(true);
    expect(NotificationChannelSchema.safeParse('push').success).toBe(true);
    expect(NotificationChannelSchema.safeParse('sms').success).toBe(false);
  });
});

describe('NotificationMetadataByType', () => {
  it('validates each per-type payload', () => {
    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'content_report',
      // reportedItemType is the canonical ReportableItemType enum (tightened from an
      // open string, 2026-07-13) — a non-canonical value must now fail.
      reportGroupId: 'rg1',
      reportedItemType: 'hall-library-item',
      reportedItemId: 'tale1',
    }).success).toBe(true);

    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'content_report',
      reportGroupId: 'rg1',
      reportedItemType: 'tale',
      reportedItemId: 'tale1',
    }).success).toBe(false);

    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'guild_invite',
      workProjectId: 'wp1',
      guildInviteId: 'gi1',
      workTitle: 'My Work',
    }).success).toBe(true);

    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'admin_dispatch_reply',
      adminDispatchId: 'ad1',
    }).success).toBe(true);

    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'threshold_library_submission',
      thresholdItemId: 'ti1',
      hallItemId: 'hi1',
      workProjectId: 'wp1',
    }).success).toBe(true);

    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'admin_announcement',
      title: 'Heads up',
      message: 'Maintenance tonight.',
    }).success).toBe(true);

    // Appellant feedback — both decisions valid; anything else rejected.
    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'content_appeal_reviewed',
      appealId: 'ap1',
      decision: 'approved',
    }).success).toBe(true);
    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'content_appeal_reviewed',
      appealId: 'ap1',
      decision: 'denied',
    }).success).toBe(true);
    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'content_appeal_reviewed',
      appealId: 'ap1',
      decision: 'pending',
    }).success).toBe(false);

    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'threshold_library_reviewed',
      thresholdItemId: 'ti1',
      hallItemId: 'hi1',
      workProjectId: 'wp1',
      workProjectType: 'Tunes',
      itemId: 'song-1',
      decision: 'needs_revision',
      adminNotes: 'please fix',
    }).success).toBe(true);

    // adminNotes is nullable — the writer sends null when the reviewer left none.
    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'threshold_library_reviewed',
      thresholdItemId: 'ti1',
      hallItemId: 'hi1',
      workProjectId: 'wp1',
      workProjectType: 'Tales',
      itemId: 'ch-1',
      decision: 'needs_revision',
      adminNotes: null,
    }).success).toBe(true);

    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'hall_content_change_request_resolved',
      changeRequestId: 'cr1',
      hallItemId: 'hi1',
      workProjectId: 'wp1',
      decision: 'denied',
      resolutionReason: 'title mismatch',
    }).success).toBe(true);

    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'hall_content_change_request_resolved',
      changeRequestId: 'cr1',
      hallItemId: 'hi1',
      workProjectId: 'wp1',
      decision: 'approved',
      resolutionReason: null,
    }).success).toBe(true);

    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'followed_content_published',
      workProjectId: 'wp1',
      workTitle: 'My Work',
      hallItemId: 'hi1',
      hallItemTitle: 'My Hall Item',
      hallSubItemType: 'chapter',
    }).success).toBe(true);

    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'member_content_published',
      workProjectId: 'wp1',
      workTitle: 'My Work',
      hallItemId: 'hi1',
      hallItemTitle: 'My Hall Item',
      hallSubItemType: 'track',
    }).success).toBe(true);

    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'followed_craft_skill_published',
      artisanUid: 'u1',
    }).success).toBe(true);

    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'report_action_taken',
      reportId: 'r1',
    }).success).toBe(true);

    // Privacy ceiling: reporter-feedback metadata must never carry fields that
    // identify the reported user/content/remedy.
    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'report_action_taken',
      reportId: 'r1',
      reportedItemId: 'nope',
    }).success).toBe(false);
  });

  it('rejects a payload whose fields do not match its discriminant', () => {
    // guild_invite fields under content_report → invalid.
    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'content_report',
      workProjectId: 'wp1',
      guildInviteId: 'gi1',
      workTitle: 'x',
    }).success).toBe(false);
  });

  it('rejects unknown extra keys (strict)', () => {
    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'admin_dispatch_reply',
      adminDispatchId: 'ad1',
      extra: 'nope',
    }).success).toBe(false);
  });
});

describe('BroadcastAudienceSelector', () => {
  it('parses every selector variant', () => {
    expect(BroadcastAudienceSelectorSchema.safeParse({ kind: 'allActiveUsers' }).success).toBe(true);
    expect(BroadcastAudienceSelectorSchema.safeParse({ kind: 'explicitUids', uids: ['u1', 'u2'] }).success).toBe(true);
    expect(BroadcastAudienceSelectorSchema.safeParse({ kind: 'workMembers', workProjectId: 'wp1' }).success).toBe(true);
    expect(BroadcastAudienceSelectorSchema.safeParse({ kind: 'realmMembers', workRealmId: 'wr1' }).success).toBe(true);
    expect(BroadcastAudienceSelectorSchema.safeParse({ kind: 'allArtisans' }).success).toBe(true);
  });

  it('rejects an empty explicit uid list and extra fields on allArtisans', () => {
    expect(BroadcastAudienceSelectorSchema.safeParse({ kind: 'explicitUids', uids: [] }).success).toBe(false);
    expect(BroadcastAudienceSelectorSchema.safeParse({ kind: 'allArtisans', tradeProfession: 'Director' }).success).toBe(false);
    expect(BroadcastAudienceSelectorSchema.safeParse({ kind: 'somethingElse' }).success).toBe(false);
  });

  it('enforces the ≤2000 explicit-uid audience cap', () => {
    const uids = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);
    expect(BroadcastAudienceSelectorSchema.safeParse({ kind: 'explicitUids', uids: uids(2000) }).success).toBe(true);
    expect(BroadcastAudienceSelectorSchema.safeParse({ kind: 'explicitUids', uids: uids(2001) }).success).toBe(false);
  });
});

describe('callable input schemas', () => {
  it('validates createNotificationBroadcast input', () => {
    expect(CreateNotificationBroadcastInputSchema.safeParse({
      requestId: 'req-1',
      selector: { kind: 'allActiveUsers' },
      title: 'Hi',
      message: 'Welcome to launch.',
    }).success).toBe(true);

    // Missing the required idempotency key is rejected.
    expect(CreateNotificationBroadcastInputSchema.safeParse({
      selector: { kind: 'allActiveUsers' },
      title: 'Hi',
      message: 'Welcome to launch.',
    }).success).toBe(false);

    expect(CreateNotificationBroadcastInputSchema.safeParse({
      requestId: 'req-1',
      selector: { kind: 'allActiveUsers' },
      title: '',
      message: 'x',
    }).success).toBe(false);
  });

  it('validates archiveNotification input (single + all) and carries no device field', () => {
    expect(ArchiveNotificationInputSchema.safeParse({
      category: 'user',
      scope: { kind: 'single', notificationId: 'n1' },
    }).success).toBe(true);

    expect(ArchiveNotificationInputSchema.safeParse({
      category: 'admin',
      scope: { kind: 'all' },
    }).success).toBe(true);

    // A `device` field is no longer part of the contract (dropped in A1).
    expect(ArchiveNotificationInputSchema.safeParse({
      category: 'user',
      scope: { kind: 'single', notificationId: 'n1' },
      device: 'web',
    }).success).toBe(false);
  });

  it('validates markNotificationsSeen input (user only)', () => {
    expect(MarkNotificationsSeenInputSchema.safeParse({ category: 'user' }).success).toBe(true);
    // Shared admin notifications have no per-admin seen state.
    expect(MarkNotificationsSeenInputSchema.safeParse({ category: 'admin' }).success).toBe(false);
  });
});

describe('audit event union', () => {
  it('includes the two notification audit events', () => {
    const events: AuditEventType[] = ['notification.broadcastSent', 'notification.adminArchived'];
    expectTypeOf(events).toEqualTypeOf<AuditEventType[]>();
    expect(events).toHaveLength(2);
  });

  it('NotificationType is the inferred enum type', () => {
    expectTypeOf<NotificationType>().toEqualTypeOf<(typeof NOTIFICATION_TYPE_VALUES)[number]>();
  });
});

// ============================================================================
// OBSERVED-GENERATION SCHEMAS (P6 tray)
// ============================================================================

describe('MarkNotificationsSeenObservedInputSchema', () => {
  it('accepts a valid single-item payload', () => {
    const result = MarkNotificationsSeenObservedInputSchema.safeParse({
      category: 'user',
      items: [
        { activeId: 'notif-abc', observedActivityGeneration: 'gen-uuid-1' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts multiple items up to the page limit', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      activeId: `notif-${i}`,
      observedActivityGeneration: `gen-${i}`,
    }));
    expect(MarkNotificationsSeenObservedInputSchema.safeParse({ category: 'user', items }).success).toBe(true);
  });

  it('rejects an empty items array', () => {
    expect(MarkNotificationsSeenObservedInputSchema.safeParse({
      category: 'user',
      items: [],
    }).success).toBe(false);
  });

  it('rejects when items exceeds the page limit (51 items)', () => {
    const items = Array.from({ length: 51 }, (_, i) => ({
      activeId: `notif-${i}`,
      observedActivityGeneration: `gen-${i}`,
    }));
    expect(MarkNotificationsSeenObservedInputSchema.safeParse({ category: 'user', items }).success).toBe(false);
  });

  it('rejects category "admin" — shared admin has no per-admin seen state', () => {
    expect(MarkNotificationsSeenObservedInputSchema.safeParse({
      category: 'admin',
      items: [{ activeId: 'n1', observedActivityGeneration: 'g1' }],
    }).success).toBe(false);
  });

  it('rejects an item with a missing activeId', () => {
    expect(MarkNotificationsSeenObservedInputSchema.safeParse({
      category: 'user',
      items: [{ observedActivityGeneration: 'g1' }],
    }).success).toBe(false);
  });

  it('rejects an item with a missing observedActivityGeneration', () => {
    expect(MarkNotificationsSeenObservedInputSchema.safeParse({
      category: 'user',
      items: [{ activeId: 'n1' }],
    }).success).toBe(false);
  });

  it('rejects an item with an empty activeId string', () => {
    expect(MarkNotificationsSeenObservedInputSchema.safeParse({
      category: 'user',
      items: [{ activeId: '', observedActivityGeneration: 'g1' }],
    }).success).toBe(false);
  });

  it('rejects unknown extra fields on the top-level object (strict)', () => {
    expect(MarkNotificationsSeenObservedInputSchema.safeParse({
      category: 'user',
      items: [{ activeId: 'n1', observedActivityGeneration: 'g1' }],
      extra: 'nope',
    }).success).toBe(false);
  });

  it('rejects unknown extra fields inside an item (strict)', () => {
    expect(MarkNotificationsSeenObservedInputSchema.safeParse({
      category: 'user',
      items: [{ activeId: 'n1', observedActivityGeneration: 'g1', extra: 'nope' }],
    }).success).toBe(false);
  });

  it('infers the correct TypeScript type', () => {
    expectTypeOf<MarkNotificationsSeenObservedInput>().toMatchTypeOf<{
      category: 'user';
      items: { activeId: string; observedActivityGeneration: string }[];
    }>();
  });
});

describe('ArchiveNotificationObservedInputSchema', () => {
  it('accepts a valid single-scope payload (user)', () => {
    const result = ArchiveNotificationObservedInputSchema.safeParse({
      requestId: 'retry-stable-uuid-1',
      category: 'user',
      scope: {
        kind: 'single',
        notificationId: 'notif-abc',
        observedActivityGeneration: 'gen-uuid-1',
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid single-scope payload (admin)', () => {
    expect(ArchiveNotificationObservedInputSchema.safeParse({
      requestId: 'retry-stable-uuid-2',
      category: 'admin',
      scope: {
        kind: 'single',
        notificationId: 'notif-xyz',
        observedActivityGeneration: 'gen-uuid-2',
      },
    }).success).toBe(true);
  });

  it('accepts a valid all-scope payload — no observedActivityGeneration at top level', () => {
    expect(ArchiveNotificationObservedInputSchema.safeParse({
      requestId: 'retry-stable-uuid-3',
      category: 'user',
      scope: { kind: 'all' },
    }).success).toBe(true);
  });

  it('rejects a missing requestId', () => {
    expect(ArchiveNotificationObservedInputSchema.safeParse({
      category: 'user',
      scope: { kind: 'all' },
    }).success).toBe(false);
  });

  it('rejects an empty requestId string', () => {
    expect(ArchiveNotificationObservedInputSchema.safeParse({
      requestId: '',
      category: 'user',
      scope: { kind: 'all' },
    }).success).toBe(false);
  });

  it('rejects a missing category', () => {
    expect(ArchiveNotificationObservedInputSchema.safeParse({
      requestId: 'r1',
      scope: { kind: 'all' },
    }).success).toBe(false);
  });

  it('rejects an invalid category value', () => {
    expect(ArchiveNotificationObservedInputSchema.safeParse({
      requestId: 'r1',
      category: 'superadmin',
      scope: { kind: 'all' },
    }).success).toBe(false);
  });

  it('rejects single scope missing notificationId', () => {
    expect(ArchiveNotificationObservedInputSchema.safeParse({
      requestId: 'r1',
      category: 'user',
      scope: { kind: 'single', observedActivityGeneration: 'g1' },
    }).success).toBe(false);
  });

  it('rejects single scope missing observedActivityGeneration', () => {
    expect(ArchiveNotificationObservedInputSchema.safeParse({
      requestId: 'r1',
      category: 'user',
      scope: { kind: 'single', notificationId: 'n1' },
    }).success).toBe(false);
  });

  it('rejects all scope with an extra observedActivityGeneration field (strict)', () => {
    // archive-all carries no single generation; reject extra fields.
    expect(ArchiveNotificationObservedInputSchema.safeParse({
      requestId: 'r1',
      category: 'user',
      scope: { kind: 'all', observedActivityGeneration: 'g1' },
    }).success).toBe(false);
  });

  it('rejects unknown extra fields on the top-level object (strict)', () => {
    expect(ArchiveNotificationObservedInputSchema.safeParse({
      requestId: 'r1',
      category: 'user',
      scope: { kind: 'all' },
      extra: 'nope',
    }).success).toBe(false);
  });

  it('rejects an unknown scope kind', () => {
    expect(ArchiveNotificationObservedInputSchema.safeParse({
      requestId: 'r1',
      category: 'user',
      scope: { kind: 'category' },
    }).success).toBe(false);
  });

  it('infers the correct TypeScript type', () => {
    expectTypeOf<ArchiveNotificationObservedInput>().toMatchTypeOf<{
      requestId: string;
      category: 'user' | 'admin';
      scope:
        | { kind: 'single'; notificationId: string; observedActivityGeneration: string }
        | { kind: 'all' };
    }>();
  });
});

describe('legacy schemas remain intact after observed-generation additions', () => {
  it('MarkNotificationsSeenInputSchema still only requires category:user', () => {
    expect(MarkNotificationsSeenInputSchema.safeParse({ category: 'user' }).success).toBe(true);
    expect(MarkNotificationsSeenInputSchema.safeParse({ category: 'admin' }).success).toBe(false);
    // Does NOT accept the new `items` field — it is the legacy schema.
    expect(MarkNotificationsSeenInputSchema.safeParse({
      category: 'user',
      items: [{ activeId: 'n1', observedActivityGeneration: 'g1' }],
    }).success).toBe(false);
  });

  it('ArchiveNotificationInputSchema still uses its original shape (no requestId / observedActivityGeneration)', () => {
    expect(ArchiveNotificationInputSchema.safeParse({
      category: 'user',
      scope: { kind: 'single', notificationId: 'n1' },
    }).success).toBe(true);
    expect(ArchiveNotificationInputSchema.safeParse({
      category: 'admin',
      scope: { kind: 'all' },
    }).success).toBe(true);
    // New fields must not be silently accepted (strict schema).
    expect(ArchiveNotificationInputSchema.safeParse({
      category: 'user',
      scope: { kind: 'all' },
      requestId: 'r1',
    }).success).toBe(false);
  });
});
