import type { AdminNotificationType } from '../types/notifications.js';
import { COMPOUND_ID_SEPARATOR } from './compound-ids.js';
import { buildRequestJobId, parseRequestJobId } from './request-job-ids.js';
import type { RequestJobIdParts } from './request-job-ids.js';

export function buildNotificationDeliveryId(
  notificationType: AdminNotificationType,
  eventId: string,
): string {
  return [notificationType, eventId].join(COMPOUND_ID_SEPARATOR);
}

export function buildLeagueFreeAgentSignedUpEventId(
  leagueId: string,
  userId: string,
  signedUpAt: number,
): string {
  return [leagueId, String(signedUpAt), userId].join(COMPOUND_ID_SEPARATOR);
}

export function buildAdminNotificationHistoryId(requestId: string, notificationId: string): string {
  return [requestId, notificationId].join(COMPOUND_ID_SEPARATOR);
}

export function buildAdminNotificationArchiveKey(
  notificationId: string,
  observedActivityGeneration: string,
): string {
  return [notificationId, observedActivityGeneration].join(COMPOUND_ID_SEPARATOR);
}

export type NotificationArchiveAllJobIdParts = RequestJobIdParts;

export function buildNotificationArchiveAllJobId(userId: string, requestId: string): string {
  return buildRequestJobId(userId, requestId);
}

export function parseNotificationArchiveAllJobId(
  id: string,
): NotificationArchiveAllJobIdParts | null {
  return parseRequestJobId(id);
}
