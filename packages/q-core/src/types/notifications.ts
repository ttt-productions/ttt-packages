import type { ArchiveAllJobSnapshot } from '@ttt-productions/notification-core';
import type {
  DeliverySkipReason,
  DeliveryState,
  MaterializationClass,
} from '@ttt-productions/notification-core/server';

// The package exports these vocabularies as types only, so each is restated here as a tuple;
// `everyMember<Union>()` makes a tuple that misses or adds a member fail to compile here instead of
// failing a row's parse in production.
function everyMember<Union extends string>() {
  return <const Keys extends readonly Union[]>(
    keys: Keys &
      ([Exclude<Union, Keys[number]>] extends [never]
        ? unknown
        : { missing: Exclude<Union, Keys[number]> }),
  ): Keys => keys;
}

export const NOTIFICATION_CATEGORY_KEYS = ['admin'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORY_KEYS)[number];
export const ADMIN_NOTIFICATION_CATEGORY = 'admin' as const satisfies NotificationCategory;

export const SHARED_NOTIFICATION_AUDIENCE_SCOPE = 'shared';

export const ADMIN_NOTIFICATION_TYPE_KEYS = [
  'leagueTeamCreated',
  'leagueFreeAgentSignedUp',
] as const;
export type AdminNotificationType = (typeof ADMIN_NOTIFICATION_TYPE_KEYS)[number];

// A Q-Sports row names no recipient, so it never reaches `skipped`, but the state is the package's
// and a row is read against all of them.
export const NOTIFICATION_DELIVERY_STATE_KEYS = everyMember<DeliveryState>()([
  'queued',
  'materialized',
  'skipped',
  'deadLetter',
]);
export type NotificationDeliveryState = (typeof NOTIFICATION_DELIVERY_STATE_KEYS)[number];

export const NOTIFICATION_DELIVERY_SKIP_REASON_KEYS = everyMember<DeliverySkipReason>()([
  'recipientIneligible',
]);

// notification-core's `fanoutOrphan` lane holds rows of an audience fanout, which Q-Sports does not
// run, so it is the one lane left out.
export const NOTIFICATION_MATERIALIZATION_CLASS_KEYS = everyMember<
  Exclude<MaterializationClass, 'fanoutOrphan'>
>()(['directQueued', 'realtimeFallback', 'retry']);
export type NotificationMaterializationClass =
  (typeof NOTIFICATION_MATERIALIZATION_CLASS_KEYS)[number];

export const NOTIFICATION_DELIVERY_PAYLOAD_VERSION = 1;

export const NOTIFICATION_ARCHIVE_ALL_JOB_STATE_KEYS = everyMember<
  ArchiveAllJobSnapshot['state']
>()(['in-progress', 'complete', 'incomplete', 'failed']);
export type NotificationArchiveAllJobState =
  (typeof NOTIFICATION_ARCHIVE_ALL_JOB_STATE_KEYS)[number];
