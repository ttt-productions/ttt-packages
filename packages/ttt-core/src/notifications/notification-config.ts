import type { NotificationSystemConfig } from '@ttt-productions/notification-core';
import { NOTIFICATION_TYPE_CATALOG } from '../schemas/notification.js';
import { COLLECTIONS } from '../paths/collections.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function catalogEntry(type: keyof typeof NOTIFICATION_TYPE_CATALOG) {
  const { category, delivery } = NOTIFICATION_TYPE_CATALOG[type];
  return { category, delivery };
}

// `dedupKeyPattern` is required by NotificationTypeConfig, but only the pendingNotifications batch
// processor reads it.
export const TTT_NOTIFICATION_CONFIG: NotificationSystemConfig = {
  categories: {
    user: {
      activePath: COLLECTIONS.ACTIVE_USER_NOTIFICATIONS,
      historyPath: (userId?: string) =>
        `${COLLECTIONS.USER_PROFILES}/${userId}/notificationHistory`,
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
      messagePattern: (_meta, count) =>
        `${count} user${count > 1 ? 's' : ''} reported this content`,
      defaultTargetPath: '/admin',
      countCap: 5000,
      actorCap: 5,
      icon: '🚩',
    },
    guild_invite: {
      ...catalogEntry('guild_invite'),
      dedupKeyPattern: (meta) => `invite_${meta.workProjectId}_${meta.guildInviteId}`,
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
      defaultTargetPath: (meta) =>
        meta.partyKind === 'workProject' && typeof meta.workProjectId === 'string'
          ? `/work-projects/${meta.workProjectId}`
          : '/messages',
      countCap: 100,
      actorCap: 1,
      icon: '📩',
    },
    admin_dispatch_created: {
      ...catalogEntry('admin_dispatch_created'),
      dedupKeyPattern: (meta) => `adminDispatchCreated_${meta.adminDispatchId}`,
      titlePattern: () => 'Admin Message',
      messagePattern: () => 'An admin has created a new thread message',
      defaultTargetPath: (meta) =>
        meta.partyKind === 'workProject' && typeof meta.workProjectId === 'string'
          ? `/work-projects/${meta.workProjectId}`
          : '/messages',
      countCap: 1,
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
      defaultTargetPath: (meta) =>
        typeof meta.workRealmId === 'string' && meta.workRealmId.length > 0
          ? `/work-realms/${meta.workRealmId}`
          : `/work-projects/${meta.workProjectId}`,
      countCap: 100,
      actorCap: 1,
      icon: '📝',
    },
    report_action_taken: {
      ...catalogEntry('report_action_taken'),
      dedupKeyPattern: (meta) => `reportActionTaken_${meta.reportId}`,
      titlePattern: () => 'Report update',
      messagePattern: () => 'A report you submitted had action taken.',
      countCap: 1,
      actorCap: 1,
      icon: '🛡️',
    },
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
      dedupKeyPattern: (meta) => `relpub_${meta.hallItemId}`,
      titlePattern: (meta) => `New in ${meta.workTitle}`,
      messagePattern: (meta, count) =>
        count > 1 ? `${count} new items published` : `"${meta.hallItemTitle}" was published`,
      defaultTargetPath: (meta) => `/hall-library/${meta.hallItemId}`,
      countCap: 5000,
      actorCap: 5,
      icon: '📖',
    },
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
    realm_file_share_requested: {
      ...catalogEntry('realm_file_share_requested'),
      dedupKeyPattern: (meta) => `realmFileShareRequested_${meta.requestId}`,
      titlePattern: () => 'Realm file request',
      messagePattern: () => 'A work file admin asked to share a file into your Realm.',
      defaultTargetPath: (meta) => `/work-realms/${meta.workRealmId}`,
      countCap: 1,
      actorCap: 1,
      icon: '🗂️',
    },
    realm_file_share_resolved: {
      ...catalogEntry('realm_file_share_resolved'),
      dedupKeyPattern: (meta) => `realmFileShareResolved_${meta.requestId}`,
      titlePattern: () => 'Realm file request update',
      messagePattern: (meta) => {
        if (meta.resolution === 'approved') {
          return 'Your file was approved and added to the Realm shared files.';
        }
        if (meta.resolution === 'declined') {
          return 'Your request to share a file to the Realm was declined.';
        }
        return 'A file-share request to your Realm was withdrawn.';
      },
      defaultTargetPath: (meta) =>
        meta.resolution === 'withdrawn'
          ? `/work-realms/${meta.workRealmId}`
          : `/work-projects/${meta.workProjectId}`,
      countCap: 1,
      actorCap: 1,
      icon: '🗃️',
    },
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
  // No `timestampFromMillis`: it needs firebase-admin, which ttt-core cannot import, so the backend
  // spreads it in.
  deliveriesCollectionPath: COLLECTIONS.NOTIFICATION_DELIVERIES,
  deliveryTtlMs: 90 * DAY_MS,
  maxDeliveryAttempts: 8,
};
