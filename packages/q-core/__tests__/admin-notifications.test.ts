import { describe, it, expect } from 'vitest';
import {
  ActiveAdminNotificationSchema,
  AdminNotificationHistorySchema,
  NotificationArchiveAllJobSchema,
  NotificationDeliverySchema,
  isAdminNotificationMetadata,
} from '../src/doc-schemas/admin-notifications.js';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry.js';
import { DomainEventSchema } from '../src/domain-events/domain-events.js';
import { buildLeagueFreeAgentId } from '../src/ids/compound-ids.js';
import {
  buildAdminNotificationArchiveKey,
  buildAdminNotificationHistoryId,
  buildLeagueFreeAgentSignedUpEventId,
  buildNotificationArchiveAllJobId,
  buildNotificationDeliveryId,
  parseNotificationArchiveAllJobId,
} from '../src/ids/notification-ids.js';
import { archiveAllPartialOutcomeMessage } from '../src/notifications/archive-all.js';
import {
  ADMIN_NOTIFICATION_DEFINITIONS,
  NOTIFICATION_SYSTEM_CONFIG,
} from '../src/notifications/admin-notification-config.js';
import {
  leagueFreeAgentSignedUpNotification,
  leagueTeamCreatedNotification,
} from '../src/notifications/occurrences.js';
import { COLLECTIONS } from '../src/paths/collections.js';
import { COLLECTION_REFS } from '../src/paths/collection-refs.js';
import { PATH_BUILDERS } from '../src/paths/path-builders.js';
import { toPath } from '../src/paths/utils.js';
import {
  AdminArchiveAllNotificationsInputSchema,
  AdminArchiveNotificationInputSchema,
  AdminGetNotificationArchiveAllStatusInputSchema,
  AdminGetNotificationArchiveAllStatusResultSchema,
} from '../src/schemas/admin-notifications.js';
import {
  GetDeadLettersInputSchema,
  GetDeadLettersResultSchema,
  AdminReplayDeadLetterInputSchema,
  AdminReplayDeadLetterResultSchema,
} from '../src/schemas/dead-letters.js';
import { AUDIT_EVENT_TYPE_KEYS } from '../src/types/audit.js';
import {
  ADMIN_NOTIFICATION_CATEGORY,
  ADMIN_NOTIFICATION_TYPE_KEYS,
  NOTIFICATION_DELIVERY_PAYLOAD_VERSION,
} from '../src/types/notifications.js';
import { APP_ROUTES, LEAGUE_FREE_AGENTS_SECTION } from '../src/paths/app-routes.js';
import { anyInstanceOf } from '../../../test/matchers.js';

const NOW = 1_760_000_000_000;
const REQUEST_ID = '2f1c0a3e-8b1d-4c6f-9a2e-5d7b3c1e9f00';
const CARD_ID = 'a'.repeat(40);
const GENERATION = '7d0b6e0e-1c1a-4f7e-9d61-0c5b0d3e2a11';

function fakeTimestamp(millis: number) {
  return {
    seconds: Math.floor(millis / 1000),
    nanoseconds: 0,
    toMillis: () => millis,
    toDate: () => new Date(millis),
  };
}

function teamCard(overrides: Record<string, unknown> = {}) {
  return {
    type: 'leagueTeamCreated',
    dedupKey: 'team-1',
    category: ADMIN_NOTIFICATION_CATEGORY,
    targetUserId: null,
    title: 'New team',
    message: 'A new team joined a league.',
    count: 1,
    latestActorIds: ['creator-1'],
    targetPath: '/league/league-1/team/team-1',
    metadata: { leagueId: 'league-1', teamId: 'team-1' },
    seenAt: 0,
    activityGeneration: GENERATION,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function deliveryRow(overrides: Record<string, unknown> = {}) {
  return {
    deliveryId: buildNotificationDeliveryId('leagueTeamCreated', 'team-1'),
    state: 'queued',
    notificationType: 'leagueTeamCreated',
    eventId: 'team-1',
    recipientUid: null,
    aggregationKey: 'team-1',
    strategy: 'increment',
    payload: {
      actorId: 'creator-1',
      metadata: { leagueId: 'league-1', teamId: 'team-1' },
      occurrenceAt: NOW,
    },
    payloadVersion: NOTIFICATION_DELIVERY_PAYLOAD_VERSION,
    materializationClass: 'realtimeFallback',
    createdAt: NOW,
    attemptCount: 0,
    nextAttemptAt: NOW,
    lastError: null,
    materializedAt: null,
    deadLetteredAt: null,
    ...overrides,
  };
}

describe('where the admin notification documents live', () => {
  it('names each collection by what its documents are', () => {
    expect(COLLECTIONS.ACTIVE_ADMIN_NOTIFICATIONS).toBe('activeAdminNotifications');
    expect(COLLECTIONS.ADMIN_NOTIFICATION_HISTORY).toBe('adminNotificationHistory');
    expect(COLLECTIONS.NOTIFICATION_DELIVERIES).toBe('notificationDeliveries');
    expect(COLLECTIONS.NOTIFICATION_ARCHIVE_ALL_JOBS).toBe('notificationArchiveAllJobs');
  });

  it('builds each document path from its collection and a ready id', () => {
    expect(toPath(PATH_BUILDERS.activeAdminNotification(CARD_ID))).toBe(
      `activeAdminNotifications/${CARD_ID}`,
    );
    expect(toPath(PATH_BUILDERS.adminNotificationHistoryEntry('h1'))).toBe(
      'adminNotificationHistory/h1',
    );
    expect(toPath(PATH_BUILDERS.notificationDelivery('d1'))).toBe('notificationDeliveries/d1');
    expect(toPath(PATH_BUILDERS.notificationArchiveAllJob('j1'))).toBe(
      'notificationArchiveAllJobs/j1',
    );
    expect(COLLECTION_REFS.notificationDeliveries()).toEqual([COLLECTIONS.NOTIFICATION_DELIVERIES]);
  });

  it('binds every collection to its schema in the registry', () => {
    expect(COLLECTION_SCHEMAS['activeAdminNotifications/{notificationId}']).toBe(
      ActiveAdminNotificationSchema,
    );
    expect(COLLECTION_SCHEMAS['adminNotificationHistory/{historyId}']).toBe(
      AdminNotificationHistorySchema,
    );
    expect(COLLECTION_SCHEMAS['notificationDeliveries/{deliveryId}']).toBe(
      NotificationDeliverySchema,
    );
    expect(COLLECTION_SCHEMAS['notificationArchiveAllJobs/{jobId}']).toBe(
      NotificationArchiveAllJobSchema,
    );
  });

  it('points the notification-core configuration at those collections, as one shared category with no seen state', () => {
    const category = NOTIFICATION_SYSTEM_CONFIG.categories[ADMIN_NOTIFICATION_CATEGORY];
    expect(category).toEqual({
      activePath: COLLECTIONS.ACTIVE_ADMIN_NOTIFICATIONS,
      historyPath: anyInstanceOf(Function),
      audienceType: 'shared',
    });
    expect(category?.historyPath()).toBe(COLLECTIONS.ADMIN_NOTIFICATION_HISTORY);
    expect(NOTIFICATION_SYSTEM_CONFIG.deliveriesCollectionPath).toBe(
      COLLECTIONS.NOTIFICATION_DELIVERIES,
    );
    expect(Object.keys(NOTIFICATION_SYSTEM_CONFIG.categories)).toEqual([
      ADMIN_NOTIFICATION_CATEGORY,
    ]);
  });
});

describe('the ids', () => {
  it('keys a delivery row by its type and its event, so two types never share a row', () => {
    expect(buildNotificationDeliveryId('leagueTeamCreated', 'team-1')).toBe(
      'leagueTeamCreated_team-1',
    );
    expect(buildNotificationDeliveryId('leagueTeamCreated', 'x')).not.toBe(
      buildNotificationDeliveryId('leagueFreeAgentSignedUp', 'x'),
    );
  });

  it('gives a free-agent signup an event id from its league, its time, and its player', () => {
    const first = buildLeagueFreeAgentSignedUpEventId('league-1', 'player-1', NOW);
    expect(first).toBe(buildLeagueFreeAgentSignedUpEventId('league-1', 'player-1', NOW));
    expect(first).not.toBe(buildLeagueFreeAgentSignedUpEventId('league-1', 'player-1', NOW + 1));
  });

  it('keys an archive by its request and its card, so one archive-all run never collides on one entry', () => {
    expect(buildAdminNotificationHistoryId(REQUEST_ID, CARD_ID)).toBe(`${REQUEST_ID}_${CARD_ID}`);
    expect(buildAdminNotificationHistoryId(REQUEST_ID, 'b'.repeat(40))).not.toBe(
      buildAdminNotificationHistoryId(REQUEST_ID, CARD_ID),
    );
    expect(buildAdminNotificationArchiveKey(CARD_ID, GENERATION)).not.toBe(
      buildAdminNotificationArchiveKey(CARD_ID, 'another-generation'),
    );
  });

  it('builds and parses an archive-all job id, the request id read from the end', () => {
    const jobId = buildNotificationArchiveAllJobId('admin-1', REQUEST_ID);
    expect(parseNotificationArchiveAllJobId(jobId)).toEqual({
      userId: 'admin-1',
      requestId: REQUEST_ID,
    });
    expect(
      parseNotificationArchiveAllJobId(buildNotificationArchiveAllJobId('ghost_1_x', REQUEST_ID)),
    ).toEqual({
      userId: 'ghost_1_x',
      requestId: REQUEST_ID,
    });
  });

  it('parses no archive-all job id that is not one', () => {
    for (const id of [
      '',
      REQUEST_ID,
      `_${REQUEST_ID}`,
      'admin-1_not-a-uuid',
      `admin/1_${REQUEST_ID}`,
      `admin-1-${REQUEST_ID}`,
    ]) {
      expect(parseNotificationArchiveAllJobId(id), id).toBeNull();
    }
  });
});

describe('the occurrences', () => {
  const team = { leagueId: 'league-1', createdByUserId: 'creator-1', createdAt: NOW };

  it("identifies a new team's occurrence by the team, and records who created it and when", () => {
    expect(leagueTeamCreatedNotification('team-1', team)).toEqual({
      type: 'leagueTeamCreated',
      eventId: 'team-1',
      aggregationKey: 'team-1',
      actorUserId: 'creator-1',
      metadata: { leagueId: 'league-1', teamId: 'team-1' },
      occurredAt: NOW,
    });
  });

  it('is deterministic: the same team makes the same occurrence, a second team another card', () => {
    expect(leagueTeamCreatedNotification('team-1', team)).toEqual(
      leagueTeamCreatedNotification('team-1', team),
    );
    expect(leagueTeamCreatedNotification('team-2', team).aggregationKey).not.toBe(
      leagueTeamCreatedNotification('team-1', team).aggregationKey,
    );
  });

  it("makes a player's later signup a new occurrence on that player's card, and another player's a new card", () => {
    const first = leagueFreeAgentSignedUpNotification({
      leagueId: 'league-1',
      userId: 'player-1',
      createdAt: NOW,
    });
    const again = leagueFreeAgentSignedUpNotification({
      leagueId: 'league-1',
      userId: 'player-1',
      createdAt: NOW + 60_000,
    });
    const other = leagueFreeAgentSignedUpNotification({
      leagueId: 'league-1',
      userId: 'player-2',
      createdAt: NOW,
    });

    expect(again.eventId).not.toBe(first.eventId);
    expect(again.aggregationKey).toBe(first.aggregationKey);
    expect(first.aggregationKey).toBe(buildLeagueFreeAgentId('league-1', 'player-1'));
    expect(other.aggregationKey).not.toBe(first.aggregationKey);
    expect(first).toMatchObject({
      actorUserId: 'player-1',
      metadata: { leagueId: 'league-1', userId: 'player-1' },
    });
  });
});

describe('what each card says and links to', () => {
  it('configures every declared type, in the one category', () => {
    expect(Object.keys(NOTIFICATION_SYSTEM_CONFIG.types).sort()).toEqual(
      [...ADMIN_NOTIFICATION_TYPE_KEYS].sort(),
    );
    for (const type of ADMIN_NOTIFICATION_TYPE_KEYS) {
      expect(NOTIFICATION_SYSTEM_CONFIG.types[type]?.category).toBe(ADMIN_NOTIFICATION_CATEGORY);
    }
  });

  it("links a new team's card to the team page, and keeps its count at one", () => {
    const config = NOTIFICATION_SYSTEM_CONFIG.types.leagueTeamCreated!;
    const metadata = { leagueId: 'league-1', teamId: 'team 1' };
    expect(config.defaultTargetPath).toBeTypeOf('function');
    expect((config.defaultTargetPath as (m: Record<string, unknown>) => string)(metadata)).toBe(
      APP_ROUTES.leagueTeam('league-1', 'team 1'),
    );
    expect(APP_ROUTES.leagueTeam('league-1', 'team 1')).toBe('/league/league-1/team/team%201');
    expect(config.titlePattern(metadata)).toBe('New team');
    expect(config.countCap).toBe(1);
  });

  it('gives every type an icon of its own, so no card falls back to the package bell', () => {
    const icons = ADMIN_NOTIFICATION_TYPE_KEYS.map(
      (type) => NOTIFICATION_SYSTEM_CONFIG.types[type]?.icon,
    );
    for (const icon of icons) expect(icon).toBeTruthy();
    expect(new Set(icons).size).toBe(icons.length);
  });

  it("links a free agent's card to the league's free agents", () => {
    const config = NOTIFICATION_SYSTEM_CONFIG.types.leagueFreeAgentSignedUp!;
    const metadata = { leagueId: 'league-1', userId: 'player-1' };
    expect((config.defaultTargetPath as (m: Record<string, unknown>) => string)(metadata)).toBe(
      '/admin?view=leagues&league=league-1&section=free-agents',
    );
    expect(APP_ROUTES.adminLeague('league-1', LEAGUE_FREE_AGENTS_SECTION)).toBe(
      '/admin?view=leagues&league=league-1&section=free-agents',
    );
    expect(config.messagePattern(metadata, 1)).toBe('A player signed up as a free agent.');
    expect(config.messagePattern(metadata, 3)).toContain('3');
  });

  it('aggregates a card on the same key the occurrence builder writes on the row', () => {
    const occurrence = leagueTeamCreatedNotification('team-1', {
      leagueId: 'league-1',
      createdByUserId: 'c',
      createdAt: NOW,
    });
    expect(
      NOTIFICATION_SYSTEM_CONFIG.types.leagueTeamCreated!.dedupKeyPattern(occurrence.metadata),
    ).toBe(occurrence.aggregationKey);
    expect(
      ADMIN_NOTIFICATION_DEFINITIONS.leagueTeamCreated.aggregationKey(occurrence.metadata),
    ).toBe(occurrence.aggregationKey);
  });

  it("refuses to build a link from metadata that is not the type's, so such a row never lights a card", () => {
    const config = NOTIFICATION_SYSTEM_CONFIG.types.leagueTeamCreated!;
    expect(() =>
      (config.defaultTargetPath as (m: Record<string, unknown>) => string)({
        leagueId: 'league-1',
      }),
    ).toThrow();
    expect(() => config.dedupKeyPattern({ leagueId: 'league-1', userId: 'player-1' })).toThrow();
  });

  it('writes no name into a card: every title and message is fixed copy, the names resolved at read', () => {
    const metadata = { leagueId: 'SENTINEL', teamId: 'SENTINEL', userId: 'SENTINEL' };
    for (const type of ADMIN_NOTIFICATION_TYPE_KEYS) {
      const config = NOTIFICATION_SYSTEM_CONFIG.types[type]!;
      expect(config.titlePattern(metadata)).not.toContain('SENTINEL');
      expect(config.messagePattern(metadata, 1)).not.toContain('SENTINEL');
    }
  });
});

describe('the document shapes', () => {
  it("reads a shared card, and refuses one with a recipient, another category, or another type's metadata", () => {
    expect(ActiveAdminNotificationSchema.safeParse(teamCard()).success).toBe(true);
    expect(
      ActiveAdminNotificationSchema.safeParse(teamCard({ targetUserId: 'admin-1' })).success,
    ).toBe(false);
    expect(ActiveAdminNotificationSchema.safeParse(teamCard({ category: 'user' })).success).toBe(
      false,
    );
    expect(
      ActiveAdminNotificationSchema.safeParse(
        teamCard({ metadata: { leagueId: 'league-1', userId: 'player-1' } }),
      ).success,
    ).toBe(false);
    expect(
      ActiveAdminNotificationSchema.safeParse(teamCard({ type: 'leagueGameFinalized' })).success,
    ).toBe(false);
  });

  it('stores ids only on a card — metadata carries no name', () => {
    expect(
      ActiveAdminNotificationSchema.safeParse(
        teamCard({ metadata: { leagueId: 'league-1', teamId: 'team-1', teamName: 'Hoopers' } }),
      ).success,
    ).toBe(false);
    expect(
      isAdminNotificationMetadata('leagueTeamCreated', { leagueId: 'league-1', teamId: 'team-1' }),
    ).toBe(true);
  });

  it('reads an archived card with who archived it and its real Timestamp expiry', () => {
    const history = {
      archiveOccurrenceId: buildAdminNotificationHistoryId(REQUEST_ID, CARD_ID),
      requestId: REQUEST_ID,
      payloadHash: buildAdminNotificationArchiveKey(CARD_ID, GENERATION),
      activeId: CARD_ID,
      observedActivityGeneration: GENERATION,
      category: ADMIN_NOTIFICATION_CATEGORY,
      audienceScope: 'shared',
      archivedSnapshot: teamCard(),
      archivedAt: NOW,
      expireAt: fakeTimestamp(NOW),
      handledBy: 'admin-1',
    };
    expect(AdminNotificationHistorySchema.safeParse(history).success).toBe(true);
    expect(AdminNotificationHistorySchema.safeParse({ ...history, expireAt: NOW }).success).toBe(
      false,
    );
    expect(
      AdminNotificationHistorySchema.safeParse({ ...history, handledBy: undefined }).success,
    ).toBe(false);
  });

  it('reads a queued, a materialized, a retrying, and a replayed delivery row', () => {
    expect(NotificationDeliverySchema.safeParse(deliveryRow()).success).toBe(true);
    expect(
      NotificationDeliverySchema.safeParse(
        deliveryRow({ state: 'materialized', materializedAt: NOW, expireAt: fakeTimestamp(NOW) }),
      ).success,
    ).toBe(true);
    expect(
      NotificationDeliverySchema.safeParse(
        deliveryRow({
          materializationClass: 'retry',
          attemptCount: 2,
          lastError: 'contention',
          nextAttemptAt: NOW + 1,
        }),
      ).success,
    ).toBe(true);
    expect(NotificationDeliverySchema.safeParse(deliveryRow({ expireAt: null })).success).toBe(
      true,
    );
  });

  it('reads a row in the skipped state as notification-core writes it, and refuses an unknown skip reason', () => {
    const skipped = deliveryRow({
      state: 'skipped',
      skipReason: 'recipientIneligible',
      skippedAt: NOW,
      expireAt: fakeTimestamp(NOW),
    });
    expect(NotificationDeliverySchema.safeParse(skipped).success).toBe(true);
    expect(
      NotificationDeliverySchema.safeParse({ ...skipped, skipReason: 'recipientGone' }).success,
    ).toBe(false);
    expect(NotificationDeliverySchema.safeParse(deliveryRow({ state: 'fanned-out' })).success).toBe(
      false,
    );
    expect(
      NotificationDeliverySchema.safeParse(deliveryRow({ materializationClass: 'fanoutOrphan' }))
        .success,
    ).toBe(false);
  });

  it("refuses a delivery row naming a recipient, or carrying another type's metadata", () => {
    expect(
      NotificationDeliverySchema.safeParse(deliveryRow({ recipientUid: 'admin-1' })).success,
    ).toBe(false);
    expect(
      NotificationDeliverySchema.safeParse(
        deliveryRow({
          payload: { actorId: 'c', metadata: { leagueId: 'L', userId: 'p' }, occurrenceAt: NOW },
        }),
      ).success,
    ).toBe(false);
  });

  it('reads an archive-all job, which expires only once complete', () => {
    const job = {
      jobId: buildNotificationArchiveAllJobId('admin-1', REQUEST_ID),
      userId: 'admin-1',
      category: ADMIN_NOTIFICATION_CATEGORY,
      state: 'in-progress',
      revision: 0,
      archived: 0,
      error: null,
      attemptCount: 0,
      nextAttemptAt: NOW,
      deadLettered: false,
      createdAt: NOW,
      updatedAt: NOW,
      completedAt: null,
      deadLetteredAt: null,
    };
    expect(NotificationArchiveAllJobSchema.safeParse(job).success).toBe(true);
    expect(
      NotificationArchiveAllJobSchema.safeParse({
        ...job,
        state: 'complete',
        completedAt: NOW,
        expireAt: fakeTimestamp(NOW),
      }).success,
    ).toBe(true);
    expect(NotificationArchiveAllJobSchema.safeParse({ ...job, state: 'running' }).success).toBe(
      false,
    );
  });

  it('records how many cards the completing drain left in the list, and reads a job without the count', () => {
    const job = {
      jobId: buildNotificationArchiveAllJobId('admin-1', REQUEST_ID),
      userId: 'admin-1',
      category: ADMIN_NOTIFICATION_CATEGORY,
      state: 'in-progress',
      revision: 0,
      archived: 0,
      error: null,
      attemptCount: 0,
      nextAttemptAt: NOW,
      deadLettered: false,
      createdAt: NOW,
      updatedAt: NOW,
      completedAt: null,
      deadLetteredAt: null,
    };
    const complete = {
      ...job,
      state: 'complete',
      completedAt: NOW,
      expireAt: fakeTimestamp(NOW),
      archived: 3,
    };
    expect(NotificationArchiveAllJobSchema.parse({ ...complete, notArchived: 2 }).notArchived).toBe(
      2,
    );
    expect(NotificationArchiveAllJobSchema.parse(complete).notArchived).toBeUndefined();
    expect(
      NotificationArchiveAllJobSchema.safeParse({ ...complete, notArchived: -1 }).success,
    ).toBe(false);
  });
});

describe('the callable contracts', () => {
  it('refuses a card id that could address anything but a card document', () => {
    const input = { requestId: REQUEST_ID, observedActivityGeneration: GENERATION };
    for (const notificationId of ['', 'a/b', '..', 'a'.repeat(129)]) {
      expect(
        AdminArchiveNotificationInputSchema.safeParse({ ...input, notificationId }).success,
        notificationId,
      ).toBe(false);
    }
  });

  it('archives one card by a fresh request id and the generation the admin saw, nothing else', () => {
    const input = {
      requestId: REQUEST_ID,
      notificationId: CARD_ID,
      observedActivityGeneration: GENERATION,
    };
    expect(AdminArchiveNotificationInputSchema.safeParse(input).success).toBe(true);
    expect(
      AdminArchiveNotificationInputSchema.safeParse({ ...input, requestId: 'not-a-uuid' }).success,
    ).toBe(false);
    expect(
      AdminArchiveNotificationInputSchema.safeParse({ ...input, category: 'admin' }).success,
    ).toBe(false);
    expect(
      AdminArchiveNotificationInputSchema.safeParse({
        requestId: REQUEST_ID,
        notificationId: CARD_ID,
      }).success,
    ).toBe(false);
  });

  it('asks for archive-all with a request id alone, and reads its status by the job id', () => {
    expect(
      AdminArchiveAllNotificationsInputSchema.safeParse({ requestId: REQUEST_ID }).success,
    ).toBe(true);
    expect(
      AdminArchiveAllNotificationsInputSchema.safeParse({ requestId: REQUEST_ID, scope: 'all' })
        .success,
    ).toBe(false);
    const jobId = buildNotificationArchiveAllJobId('admin-1', REQUEST_ID);
    expect(AdminGetNotificationArchiveAllStatusInputSchema.safeParse({ jobId }).success).toBe(true);
    expect(
      AdminGetNotificationArchiveAllStatusInputSchema.safeParse({ jobId: 'admin-1' }).success,
    ).toBe(false);
    expect(
      AdminGetNotificationArchiveAllStatusResultSchema.safeParse({
        state: 'complete',
        category: 'admin',
        archived: 4,
      }).success,
    ).toBe(true);
  });

  it('reports with a completed job the cards it could not archive', () => {
    const status = { state: 'complete', category: 'admin', archived: 4 };
    expect(
      AdminGetNotificationArchiveAllStatusResultSchema.safeParse({ ...status, notArchived: 1 })
        .success,
    ).toBe(true);
    expect(
      AdminGetNotificationArchiveAllStatusResultSchema.safeParse({ ...status, notArchived: -1 })
        .success,
    ).toBe(false);
  });

  it('says how many were archived and how many are still in the list, one card read as one', () => {
    expect(archiveAllPartialOutcomeMessage(10, 2)).toBe(
      "Archived 10. 2 couldn't be archived and are still in the list.",
    );
    expect(archiveAllPartialOutcomeMessage(3, 1)).toBe(
      "Archived 3. 1 couldn't be archived and is still in the list.",
    );
  });
});

describe('the dead-letter repair contracts', () => {
  const deliveryId = buildNotificationDeliveryId('leagueTeamCreated', 'team-1');

  it('lists the dead letters of every lane or one, capped per lane, each a lane, a row id, and its facts', () => {
    for (const input of [
      undefined,
      null,
      {},
      { collection: 'notificationDeliveries' },
      { limit: 200 },
    ]) {
      expect(GetDeadLettersInputSchema.safeParse(input).success, JSON.stringify(input)).toBe(true);
    }
    expect(GetDeadLettersInputSchema.safeParse({ limit: 201 }).success).toBe(false);
    expect(GetDeadLettersInputSchema.safeParse({ collection: 'auditEvents' }).success).toBe(false);
    const row = {
      collection: 'notificationDeliveries',
      docId: deliveryId,
      deadLetteredAt: NOW,
      lastError: 'boom',
      attemptCount: 8,
    };
    expect(
      GetDeadLettersResultSchema.safeParse({ generatedAt: NOW, rows: [row], truncated: false })
        .success,
    ).toBe(true);
    expect(
      GetDeadLettersResultSchema.safeParse({
        generatedAt: NOW,
        rows: [{ ...row, deadLetteredAt: null, lastError: null, attemptCount: null }],
        truncated: true,
      }).success,
    ).toBe(true);
    expect(
      GetDeadLettersResultSchema.safeParse({
        generatedAt: NOW,
        rows: [{ ...row, path: 'a/b' }],
        truncated: false,
      }).success,
    ).toBe(false);
  });

  it('replays one dead-lettered delivery row, named by its lane and id, for a reason the admin gives (RULE-STD-BACKEND-212)', () => {
    const input = {
      collection: 'notificationDeliveries',
      docId: deliveryId,
      reason: 'The league was restored.',
    };
    expect(AdminReplayDeadLetterInputSchema.safeParse(input).success).toBe(true);
    expect(AdminReplayDeadLetterInputSchema.safeParse({ ...input, dryRun: true }).success).toBe(
      true,
    );
    expect(
      AdminReplayDeadLetterInputSchema.safeParse({
        collection: 'notificationDeliveries',
        docId: deliveryId,
      }).success,
    ).toBe(false);
    expect(AdminReplayDeadLetterInputSchema.safeParse({ ...input, reason: '   ' }).success).toBe(
      false,
    );
    for (const badId of ['', 'notificationDeliveries/x', `${deliveryId}/sub`]) {
      expect(
        AdminReplayDeadLetterInputSchema.safeParse({ ...input, docId: badId }).success,
        badId,
      ).toBe(false);
    }
    expect(
      AdminReplayDeadLetterInputSchema.safeParse({ ...input, collection: 'auditEvents' }).success,
    ).toBe(false);
    expect(AdminReplayDeadLetterInputSchema.safeParse({ ...input, all: true }).success).toBe(false);
  });

  it('answers a performed replay or a dry run, and nothing else', () => {
    const target = { collection: 'notificationDeliveries', docId: deliveryId };
    expect(
      AdminReplayDeadLetterResultSchema.safeParse({ ...target, replayed: true, resetTo: 'queued' })
        .success,
    ).toBe(true);
    expect(
      AdminReplayDeadLetterResultSchema.safeParse({
        ...target,
        dryRun: true,
        currentStatus: 'deadLetter',
        wouldResetTo: 'queued',
      }).success,
    ).toBe(true);
    expect(
      AdminReplayDeadLetterResultSchema.safeParse({ ...target, replayed: false }).success,
    ).toBe(false);
  });
});

describe('the shared vocabulary', () => {
  it('declares the audit events an archive, an archive-all decision, and a dead-letter replay record', () => {
    expect(AUDIT_EVENT_TYPE_KEYS as readonly string[]).toContain('adminNotification.archived');
    expect(AUDIT_EVENT_TYPE_KEYS as readonly string[]).toContain(
      'adminNotification.archiveAllRequested',
    );
    expect(AUDIT_EVENT_TYPE_KEYS as readonly string[]).toContain('system.manualIntervention');
  });

  it('declares the domain event the client refreshes the cards on, naming no card', () => {
    expect(DomainEventSchema.safeParse({ type: 'deadLetter.replayed', ids: {} }).success).toBe(
      true,
    );
    expect(
      DomainEventSchema.safeParse({ type: 'deadLetter.replayed', ids: { notificationId: CARD_ID } })
        .success,
    ).toBe(false);
  });
});
