// The admin notification vocabulary. Q-Sports notifies admins only, through one shared audience:
// every admin reads the same cards, and seeing or archiving a card does so for all of them.
// `@ttt-productions/notification-core` owns the delivery, seen, and archive mechanism; what is
// declared here is Q-Sports' side of it — the category, the notification types, and the states the
// ledger and the archive-all jobs move through.

import type { ArchiveAllJobSnapshot } from '@ttt-productions/notification-core';
import type {
  DeliverySkipReason,
  DeliveryState,
  MaterializationClass,
} from '@ttt-productions/notification-core/server';

// The package exports these vocabularies as types only, so each is restated here as a tuple the doc
// schemas build their enums from. `everyMember<Union>()` accepts a tuple only when it names every
// member of `Union` and nothing else, so a vocabulary the package grows or renames fails to compile
// here instead of failing a row's parse in production.
function everyMember<Union extends string>() {
  return <const Keys extends readonly Union[]>(
    keys: Keys & ([Exclude<Union, Keys[number]>] extends [never] ? unknown : { missing: Exclude<Union, Keys[number]> }),
  ): Keys => keys;
}

// The one notification category. It is shared, so a card has no recipient.
export const NOTIFICATION_CATEGORY_KEYS = ['admin'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORY_KEYS)[number];
export const ADMIN_NOTIFICATION_CATEGORY = 'admin' as const satisfies NotificationCategory;

// The audience scope notification-core records on an archived shared card, and hashes into a shared
// card's id in place of a recipient.
export const SHARED_NOTIFICATION_AUDIENCE_SCOPE = 'shared';

// What an admin is notified of: a team joining a league, and a player signing up as a free agent.
export const ADMIN_NOTIFICATION_TYPE_KEYS = ['leagueTeamCreated', 'leagueFreeAgentSignedUp'] as const;
export type AdminNotificationType = (typeof ADMIN_NOTIFICATION_TYPE_KEYS)[number];

// A delivery row's life on the ledger, as notification-core writes it. `skipped` is the terminal state
// of a row whose recipient may no longer receive; a Q-Sports row names no recipient, so it never
// reaches it, but the state is the package's and a row is read against all of them.
export const NOTIFICATION_DELIVERY_STATE_KEYS = everyMember<DeliveryState>()([
  'queued',
  'materialized',
  'skipped',
  'deadLetter',
]);
export type NotificationDeliveryState = (typeof NOTIFICATION_DELIVERY_STATE_KEYS)[number];

// Why notification-core turned a row `skipped`.
export const NOTIFICATION_DELIVERY_SKIP_REASON_KEYS = everyMember<DeliverySkipReason>()(['recipientIneligible']);

// The worker lane a delivery row waits in: `directQueued` for a type only the worker materializes,
// `realtimeFallback` for a type its owning callable also materializes right after its commit, and
// `retry`, which notification-core moves a row into after a failed attempt. notification-core's
// fourth lane, `fanoutOrphan`, holds rows of an audience fanout, which Q-Sports does not run, so it is
// the one lane left out.
export const NOTIFICATION_MATERIALIZATION_CLASS_KEYS = everyMember<Exclude<MaterializationClass, 'fanoutOrphan'>>()([
  'directQueued',
  'realtimeFallback',
  'retry',
]);
export type NotificationMaterializationClass = (typeof NOTIFICATION_MATERIALIZATION_CLASS_KEYS)[number];

// The shape of the occurrence payload every delivery row carries. A change to it is a new version,
// so a row written under the old one is still read as what it is.
export const NOTIFICATION_DELIVERY_PAYLOAD_VERSION = 1;

// An archive-all job's state, which the status read hands the client's poller unchanged.
export const NOTIFICATION_ARCHIVE_ALL_JOB_STATE_KEYS = everyMember<ArchiveAllJobSnapshot['state']>()([
  'in-progress',
  'complete',
  'incomplete',
  'failed',
]);
export type NotificationArchiveAllJobState = (typeof NOTIFICATION_ARCHIVE_ALL_JOB_STATE_KEYS)[number];
