// The one notification configuration, read by both roots: the Cloud Functions ledger that writes
// the cards, and the admin area that lists them. notification-core supplies the mechanism and takes
// Q-Sports' policy here — the shared category, where its documents live, and per type the copy, the
// icon, the link, and the key its cards aggregate on.
//
// The Functions side adds the one field this module cannot carry: `timestampFromMillis`, which needs
// the Admin SDK (RULE-STD-ARCH-202).

import type {
  NotificationSystemConfig,
  NotificationTypeConfig,
} from '@ttt-productions/notification-core';
import { ADMIN_NOTIFICATION_METADATA_SCHEMAS } from '../doc-schemas/admin-notifications.js';
import type { AdminNotificationMetadataByType } from '../doc-schemas/admin-notifications.js';
import { COLLECTION_REFS } from '../paths/collection-refs.js';
import { toPath } from '../paths/utils.js';
import { buildLeagueFreeAgentId } from '../ids/compound-ids.js';
import {
  ADMIN_NOTIFICATION_CATEGORY,
  ADMIN_NOTIFICATION_TYPE_KEYS,
} from '../types/notifications.js';
import type { AdminNotificationType } from '../types/notifications.js';
import { APP_ROUTES, LEAGUE_FREE_AGENTS_SECTION } from '../paths/app-routes.js';

export interface AdminNotificationDefinition<T extends AdminNotificationType> {
  /**
   * The key its cards aggregate on: an occurrence whose key matches an active card lights that card
   * again and counts on it, and any other occurrence opens a new card.
   */
  aggregationKey: (metadata: AdminNotificationMetadataByType[T]) => string;
  /**
   * `realtime`: the owning callable materializes the card right after its commit, and the worker is
   * the fallback. `queued`: the worker alone materializes it.
   */
  delivery: NotificationTypeConfig['delivery'];
  title: string;
  /** The emoji its cards show beside their title. */
  icon: string;
  message: (count: number) => string;
  /** Where the card's link goes. */
  targetPath: (metadata: AdminNotificationMetadataByType[T]) => string;
  /** The highest count a card of this type shows. */
  countCap?: number;
}

export const ADMIN_NOTIFICATION_DEFINITIONS: {
  [T in AdminNotificationType]: AdminNotificationDefinition<T>;
} = {
  leagueTeamCreated: {
    // One card per team, so each card links to its own team page.
    aggregationKey: ({ teamId }) => teamId,
    delivery: 'realtime',
    title: 'New team',
    icon: '👥',
    message: () => 'A new team joined a league.',
    targetPath: ({ leagueId, teamId }) => APP_ROUTES.leagueTeam(leagueId, teamId),
    countCap: 1,
  },
  leagueFreeAgentSignedUp: {
    // One card per player per league: another player's signup is a card of its own, and the same
    // player signing up again lights their card again. Every card links to the league's free agents.
    aggregationKey: ({ leagueId, userId }) => buildLeagueFreeAgentId(leagueId, userId),
    delivery: 'realtime',
    title: 'Free agent signup',
    icon: '🙋',
    message: (count) =>
      count === 1
        ? 'A player signed up as a free agent.'
        : `A player signed up as a free agent ${count} times.`,
    targetPath: ({ leagueId }) => APP_ROUTES.adminLeague(leagueId, LEAGUE_FREE_AGENTS_SECTION),
  },
};

// The package hands every pattern the stored metadata untyped. It is parsed against the type's own
// schema, so a row whose metadata is not its type's fails to materialize — and is retried, then
// dead-lettered — rather than lighting a card with a broken link.
function typeConfig<T extends AdminNotificationType>(type: T): NotificationTypeConfig {
  const definition = ADMIN_NOTIFICATION_DEFINITIONS[type];
  const read = (metadata: Record<string, unknown>) =>
    ADMIN_NOTIFICATION_METADATA_SCHEMAS[type].parse(metadata) as AdminNotificationMetadataByType[T];
  return {
    category: ADMIN_NOTIFICATION_CATEGORY,
    delivery: definition.delivery,
    dedupKeyPattern: (metadata) => definition.aggregationKey(read(metadata)),
    titlePattern: () => definition.title,
    icon: definition.icon,
    messagePattern: (_metadata, count) => definition.message(count),
    defaultTargetPath: (metadata) => definition.targetPath(read(metadata)),
    ...(definition.countCap === undefined ? {} : { countCap: definition.countCap }),
  };
}

export const NOTIFICATION_SYSTEM_CONFIG: NotificationSystemConfig = {
  categories: {
    [ADMIN_NOTIFICATION_CATEGORY]: {
      activePath: toPath(COLLECTION_REFS.activeAdminNotifications()),
      historyPath: () => toPath(COLLECTION_REFS.adminNotificationHistory()),
      audienceType: 'shared',
    },
  },
  types: Object.fromEntries(ADMIN_NOTIFICATION_TYPE_KEYS.map((type) => [type, typeConfig(type)])),
  deliveriesCollectionPath: toPath(COLLECTION_REFS.notificationDeliveries()),
};
