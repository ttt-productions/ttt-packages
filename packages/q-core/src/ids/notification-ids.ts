import { z } from 'zod';
import type { AdminNotificationType } from '../types/notifications.js';
import { COMPOUND_ID_SEPARATOR } from './compound-ids.js';

const requestIdSchema = z.uuid();

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

export interface NotificationArchiveAllJobIdParts {
  userId: string;
  requestId: string;
}

const REQUEST_ID_LENGTH = 36;

export function buildNotificationArchiveAllJobId(userId: string, requestId: string): string {
  return [userId, requestId].join(COMPOUND_ID_SEPARATOR);
}

export function parseNotificationArchiveAllJobId(
  id: string,
): NotificationArchiveAllJobIdParts | null {
  const separatorAt = id.length - REQUEST_ID_LENGTH - COMPOUND_ID_SEPARATOR.length;
  if (separatorAt < 1 || !id.startsWith(COMPOUND_ID_SEPARATOR, separatorAt)) return null;
  const userId = id.slice(0, separatorAt);
  const requestId = id.slice(separatorAt + COMPOUND_ID_SEPARATOR.length);
  if (userId.includes('/') || !requestIdSchema.safeParse(requestId).success) return null;
  return { userId, requestId };
}
