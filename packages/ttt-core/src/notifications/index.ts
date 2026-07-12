// The ONE TTT notification system config (frontend + backend).
//
// This is the single cross-boundary source for the notification type table:
// per-type copy (title/message patterns), navigation (defaultTargetPath), caps,
// icons, and the category collection paths. ttt-prod's frontend tray AND its
// Cloud Functions delivery engine both import THIS object — the previous twin
// configs (src/lib/notification-config.ts + functions/src/notifications/
// notification-config.ts) drifted apart and are replaced by it.
//
// Backend wrapping: the Cloud Functions side must spread in the one
// environment-specific field this shared object cannot carry —
// `timestampFromMillis` needs firebase-admin, which may never enter ttt-core's
// server-safe main graph:
//
//   const config = { ...TTT_NOTIFICATION_CONFIG,
//     timestampFromMillis: (ms) => admin.firestore.Timestamp.fromMillis(ms) };
//
// Category/delivery per type derive from NOTIFICATION_TYPE_CATALOG
// (../schemas/notification.js) so each type has exactly ONE authoritative row —
// never restate them here. A new notification type is added there first (VALUES,
// catalog, metadata union), then given its display entry here.
//
// LINKLESS types (`report_action_taken`, `admin_announcement`) declare NO
// `defaultTargetPath`: the written doc omits `targetPath` and the tray renders a
// clear-only row (X, no go-to arrow). Never point a type at '/' as a
// pseudo-target — a go-to arrow that lands on the homepage is a dead control
// (found live 2026-07-09 on the report-acted-on card).

import type { NotificationSystemConfig } from '@ttt-productions/notification-core';
import { NOTIFICATION_TYPE_CATALOG } from '../schemas/notification.js';
import { COLLECTIONS } from '../paths/collections.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Category + delivery for one type, sourced from the canonical catalog. */
function catalogEntry(type: keyof typeof NOTIFICATION_TYPE_CATALOG) {
  const { category, delivery } = NOTIFICATION_TYPE_CATALOG[type];
  return { category, delivery };
}

// NOTE: `dedupKeyPattern` on each type below is LEGACY on the reliable/fanout
// delivery paths (their active-card key is the caller-supplied aggregationKey /
// aggregationKeyFor(job)); it remains live ONLY for the pendingNotifications
// batch processor and is required by the generic NotificationTypeConfig shape.
// Do not rely on it as the dedup source of truth.
export const TTT_NOTIFICATION_CONFIG: NotificationSystemConfig = {
  categories: {
    user: {
      activePath: COLLECTIONS.ACTIVE_USER_NOTIFICATIONS,
      historyPath: (userId?: string) => `${COLLECTIONS.USER_PROFILES}/${userId}/notificationHistory`,
      audienceType: 'personal',
    },
    admin: {
      activePath: COLLECTIONS.ACTIVE_ADMIN_NOTIFICATIONS,
      historyPath: () => COLLECTIONS.ADMIN_NOTIFICATION_HISTORY,
      audienceType: 'shared',
    },
  },
  types: {
    content_report: {
      ...catalogEntry('content_report'),
      dedupKeyPattern: (meta) => `report_${meta.reportedItemId}`,
      titlePattern: (meta) => `Content Report: ${meta.reportedItemType}`,
      messagePattern: (_meta, count) => `${count} user${count > 1 ? 's' : ''} reported this content`,
      defaultTargetPath: '/admin',
      countCap: 5000,
      actorCap: 5,
      icon: '🚩',
    },
    guild_invite: {
      ...catalogEntry('guild_invite'),
      dedupKeyPattern: (meta) => `invite_${meta.workProjectId}_${meta.guildInviteId}`,
      // Title carries no work-title snapshot — the display surface resolves the current
      // work name by `meta.workProjectId` (Display Identity Invariant).
      titlePattern: () => 'Guild Invite',
      messagePattern: () => 'You have been invited to collaborate',
      defaultTargetPath: '/invites',
      countCap: 100,
      actorCap: 5,
      icon: '📬',
    },
    admin_dispatch_reply: {
      ...catalogEntry('admin_dispatch_reply'),
      dedupKeyPattern: (meta) => `adminDispatchReply_${meta.adminDispatchId}`,
      titlePattern: () => 'Admin Reply',
      messagePattern: (meta) =>
        meta.partyKind === 'workProject'
          ? 'An admin has responded in a work correspondence thread'
          : 'An admin has responded to your message',
      // Work-party threads route to the Work's correspondence surface; user threads
      // to the personal Messages tray. (`partyKind`/`workProjectId` come from the
      // typed metadata — see NotificationMetadataByTypeSchema.)
      defaultTargetPath: (meta) =>
        meta.partyKind === 'workProject' && typeof meta.workProjectId === 'string'
          ? `/work-projects/${meta.workProjectId}`
          : '/messages',
      countCap: 100,
      actorCap: 1,
      icon: '📩',
    },
    threshold_library_submission: {
      ...catalogEntry('threshold_library_submission'),
      dedupKeyPattern: (meta) => `thresholdLibrarySubmission_${meta.workProjectId}`,
      titlePattern: () => 'Threshold Library Submission',
      messagePattern: () => 'New content submitted for review',
      defaultTargetPath: '/admin',
      countCap: 100,
      actorCap: 5,
      icon: '📚',
    },
    // Author feedback for a review decision (only needs_revision is delivered — an
    // approval reaches the author through the publish-side member fanout). Keyed
    // per threshold item so a re-decision of the same item coalesces. The card
    // surfaces the reviewer notes so the author knows what to fix.
    threshold_library_reviewed: {
      ...catalogEntry('threshold_library_reviewed'),
      dedupKeyPattern: (meta) => `thresholdReviewed_${meta.thresholdItemId}`,
      titlePattern: () => 'Library review update',
      messagePattern: (meta) =>
        typeof meta.adminNotes === 'string' && meta.adminNotes.trim().length > 0
          ? `Your submission needs revision: ${meta.adminNotes}`
          : 'Your submission needs revision before it can be published.',
      defaultTargetPath: (meta) => `/work-projects/${meta.workProjectId}`,
      countCap: 100,
      actorCap: 1,
      icon: '📝',
    },
    // Proposer feedback for a PUBLISHED change-request decision. Keyed per change
    // request so a re-decision coalesces. The card surfaces the resolution reason
    // (required on a deny, optional on an approve).
    hall_content_change_request_resolved: {
      ...catalogEntry('hall_content_change_request_resolved'),
      dedupKeyPattern: (meta) => `hallChangeReq_${meta.changeRequestId}`,
      titlePattern: () => 'Change request update',
      messagePattern: (meta) => {
        const reason =
          typeof meta.resolutionReason === 'string' && meta.resolutionReason.trim().length > 0
            ? ` ${meta.resolutionReason}`
            : '';
        return meta.decision === 'approved'
          ? `Your requested changes were approved.${reason}`
          : `Your requested changes were denied.${reason}`;
      },
      // Realm-grain resolutions (R1) deep-link to the realm page — the request's status
      // hint lives there, not on the founding Work the request carries as workProjectId.
      defaultTargetPath: (meta) =>
        typeof meta.workRealmId === 'string' && meta.workRealmId.length > 0
          ? `/work-realms/${meta.workRealmId}`
          : `/work-projects/${meta.workProjectId}`,
      countCap: 100,
      actorCap: 1,
      icon: '📝',
    },
    // Reporter feedback (DJ ruling 2026-07-06): fires ONLY when a report closes
    // as a real case WITH action (root → `actioned`); never on dismissals.
    // Generic copy is the PRIVACY CEILING — the card must never name the
    // reported user, the reason, or the remedy (a bad-faith reporter must not
    // be able to probe moderation outcomes), and it is LINKLESS (no
    // defaultTargetPath → clear-only row). Keyed per report root → at most one
    // card per report filed.
    report_action_taken: {
      ...catalogEntry('report_action_taken'),
      dedupKeyPattern: (meta) => `reportActionTaken_${meta.reportId}`,
      titlePattern: () => 'Report update',
      messagePattern: () => 'A report you submitted had action taken.',
      countCap: 1,
      actorCap: 1,
      icon: '🛡️',
    },
    // Appellant feedback for a content-appeal decision (approve/deny). Keyed per
    // appeal so a re-decision coalesces. It is the appellant's OWN appeal — no
    // privacy ceiling applies (contrast report_action_taken): the card states the
    // outcome plainly. Targets My Uploads, where the resulting upload state lives
    // (an approval re-queues the content for processing; a denial leaves the
    // rejected state standing).
    content_appeal_reviewed: {
      ...catalogEntry('content_appeal_reviewed'),
      dedupKeyPattern: (meta) => `appealReviewed_${meta.appealId}`,
      titlePattern: () => 'Appeal decision',
      messagePattern: (meta) =>
        meta.decision === 'approved'
          ? 'Your appeal was approved — your content is being restored.'
          : 'Your appeal was denied. The moderation decision stands.',
      defaultTargetPath: '/profile/uploads',
      countCap: 100,
      actorCap: 1,
      icon: '⚖️',
    },
    // Admin broadcast. LINKLESS — the card IS the content (title + message);
    // there is nowhere meaningful to navigate.
    admin_announcement: {
      ...catalogEntry('admin_announcement'),
      dedupKeyPattern: (meta) => `announcement_${meta.title}`,
      titlePattern: (meta) => `${meta.title}`,
      messagePattern: (meta) => `${meta.message}`,
      countCap: 100,
      actorCap: 1,
      icon: '📢',
    },
    followed_content_published: {
      ...catalogEntry('followed_content_published'),
      // Dedup keyed on the Work's hall item so a follower of both the Work AND
      // its canon Realm gets ONE notification per release, and repeated
      // sub-item publishes coalesce into a single "N new items" notification.
      dedupKeyPattern: (meta) => `relpub_${meta.hallItemId}`,
      titlePattern: (meta) => `New in ${meta.workTitle}`,
      messagePattern: (meta, count) =>
        count > 1 ? `${count} new items published` : `"${meta.hallItemTitle}" was published`,
      defaultTargetPath: (meta) => `/hall-library/${meta.hallItemId}`,
      countCap: 5000,
      actorCap: 5,
      icon: '📖',
    },
    // P7 Hall-publish MEMBER job ("your work was published!"). Type-scoped dedup
    // (`mempub_`) so a member who ALSO follows the Work gets this member card AND
    // the follower card as distinct notifications (different types → different
    // active-doc ids). Targets the stable Work route, not the Hall route.
    member_content_published: {
      ...catalogEntry('member_content_published'),
      dedupKeyPattern: (meta) => `mempub_${meta.hallItemId}`,
      titlePattern: (meta) => `Your work "${meta.workTitle}" was published`,
      messagePattern: (meta, count) =>
        count > 1
          ? `${count} of your items were published to the Hall Library`
          : `"${meta.hallItemTitle}" is now in the Hall Library`,
      defaultTargetPath: (meta) => `/work-projects/${meta.workProjectId}`,
      countCap: 5000,
      actorCap: 5,
      icon: '🎉',
    },
    // P7 craft-skill publish → the artisan's followers. `staticRelight` (the
    // engine's strategyForType sets it): count stays 1, copy is static, no count
    // shown. Aggregation is per-artisan (`craftskill_<uid>`), reused across skill
    // occurrences, so the card relights. R34: the job carries only `{ artisanUid }`
    // (no `actorId`), so `latestActorIds` is always empty for this type — any actor
    // avatar/name must resolve at render from `metadata.artisanUid`, NOT latestActorIds.
    // Targets the stable artisan profile route.
    followed_craft_skill_published: {
      ...catalogEntry('followed_craft_skill_published'),
      dedupKeyPattern: (meta) => `craftskill_${meta.artisanUid}`,
      titlePattern: () => 'New craft skills',
      messagePattern: () => 'An artisan you follow uploaded new craft skills',
      defaultTargetPath: (meta) => `/profile/${meta.artisanUid}`,
      countCap: 1,
      actorCap: 1,
      icon: '🎨',
    },
  },
  batchIntervalMinutes: 10,
  pendingCollectionPath: COLLECTIONS.PENDING_NOTIFICATIONS,
  // Delivery ledger (notification redesign P1/P1b). `timestampFromMillis` is
  // deliberately ABSENT here — Firestore native TTL needs a real Timestamp, which
  // requires firebase-admin; the backend wrapper injects it (see header).
  deliveriesCollectionPath: COLLECTIONS.NOTIFICATION_DELIVERIES,
  deliveryTtlMs: 90 * DAY_MS,
  maxDeliveryAttempts: 8,
};
