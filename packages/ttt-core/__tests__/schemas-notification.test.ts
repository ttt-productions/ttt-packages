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
  type NotificationType,
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
    expect(NOTIFICATION_TYPE_CATALOG.content_report_csam).toMatchObject({ category: 'admin', delivery: 'realtime' });
    expect(NOTIFICATION_TYPE_CATALOG.guild_invite).toMatchObject({ category: 'user', delivery: 'queued' });
    expect(NOTIFICATION_TYPE_CATALOG.guild_chat_message).toMatchObject({ category: 'user', delivery: 'queued' });
    expect(NOTIFICATION_TYPE_CATALOG.admin_dispatch_reply).toMatchObject({ category: 'user', delivery: 'realtime' });
    expect(NOTIFICATION_TYPE_CATALOG.threshold_library_submission).toMatchObject({ category: 'admin', delivery: 'queued' });
    expect(NOTIFICATION_TYPE_CATALOG.admin_announcement).toMatchObject({ category: 'user', delivery: 'queued' });
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
      reportGroupId: 'rg1',
      reportedItemType: 'tale',
      reportedItemId: 'tale1',
    }).success).toBe(true);

    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'guild_invite',
      workProjectId: 'wp1',
      guildInviteId: 'gi1',
      workTitle: 'My Work',
    }).success).toBe(true);

    expect(NotificationMetadataByTypeSchema.safeParse({
      type: 'guild_chat_message',
      workProjectId: 'wp1',
      channelId: 'ch1',
      channelName: 'general',
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
});

describe('callable input schemas', () => {
  it('validates createNotificationBroadcast input', () => {
    expect(CreateNotificationBroadcastInputSchema.safeParse({
      selector: { kind: 'allActiveUsers' },
      title: 'Hi',
      message: 'Welcome to launch.',
    }).success).toBe(true);

    expect(CreateNotificationBroadcastInputSchema.safeParse({
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
