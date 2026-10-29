// Admin notification ids. Each is deterministic from what it names, so a retried write lands on the
// document the first attempt wrote and never beside it (RULE-STD-BACKEND-304, RULE-STD-BACKEND-306).
//
// A shared card's own id is not here: notification-core derives it from the notification type and
// the aggregation key.

import { z } from 'zod';
import type { AdminNotificationType } from '../types/notifications.js';
import { COMPOUND_ID_SEPARATOR } from './compound-ids.js';

const requestIdSchema = z.uuid();

// notificationDeliveries/{notificationType}_{eventId} — one occurrence of one notification type. The
// type leads, so two types recording the same action never share a row.
export function buildNotificationDeliveryId(
  notificationType: AdminNotificationType,
  eventId: string,
): string {
  return [notificationType, eventId].join(COMPOUND_ID_SEPARATOR);
}

// A player's free-agent signup in a league. A player can sign up, be placed on a team, and sign up
// again later, so the signup's time is part of the id: a later signup is a new occurrence, while a
// retry of the same signup is the same one.
export function buildLeagueFreeAgentSignedUpEventId(
  leagueId: string,
  userId: string,
  signedUpAt: number,
): string {
  return [leagueId, String(signedUpAt), userId].join(COMPOUND_ID_SEPARATOR);
}

// adminNotificationHistory/{requestId}_{notificationId} — one archive of one card. The archive's
// request id alone would let one "archive all" run's cards collide on one entry.
export function buildAdminNotificationHistoryId(requestId: string, notificationId: string): string {
  return [requestId, notificationId].join(COMPOUND_ID_SEPARATOR);
}

// The replay key an archive stores on its history entry: the card, and the generation of it the
// admin saw. An archive replayed with the same request finds its entry and the same key, and changes
// nothing.
export function buildAdminNotificationArchiveKey(
  notificationId: string,
  observedActivityGeneration: string,
): string {
  return [notificationId, observedActivityGeneration].join(COMPOUND_ID_SEPARATOR);
}

// notificationArchiveAllJobs/{userId}_{requestId} — one admin's one "archive all" request. A retry of
// the request finds the job its first attempt created. The request id is a UUID, so it is the part
// read from the end.
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
