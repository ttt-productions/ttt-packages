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
  aggregationKey: (metadata: AdminNotificationMetadataByType[T]) => string;
  delivery: NotificationTypeConfig['delivery'];
  title: string;
  icon: string;
  message: (count: number) => string;
  targetPath: (metadata: AdminNotificationMetadataByType[T]) => string;
  countCap?: number;
}

export const ADMIN_NOTIFICATION_DEFINITIONS: {
  [T in AdminNotificationType]: AdminNotificationDefinition<T>;
} = {
  leagueTeamCreated: {
    aggregationKey: ({ teamId }) => teamId,
    delivery: 'realtime',
    title: 'New team',
    icon: '👥',
    message: () => 'A new team joined a league.',
    targetPath: ({ leagueId, teamId }) => APP_ROUTES.leagueTeam(leagueId, teamId),
    countCap: 1,
  },
  leagueFreeAgentSignedUp: {
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

// The package hands every pattern the stored metadata untyped, so it is parsed against the type's
// own schema.
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
