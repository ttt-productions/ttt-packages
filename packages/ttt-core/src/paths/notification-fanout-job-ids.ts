// Its own module: the notification type schema's module graph loads compound-ids, so the parser
// would be a cycle there.

import { NotificationTypeSchema, type NotificationType } from '../schemas/notification.js';

export interface NotificationFanoutJobDocIdParts {
  readonly eventId: string;
  readonly notificationType: NotificationType;
}

// An event id may hold colons and a type never does, so the split is at the last colon.
export function parseNotificationFanoutJobDocId(
  docId: string,
): NotificationFanoutJobDocIdParts | null {
  const colon = docId.lastIndexOf(':');
  if (colon < 1) return null;
  const type = NotificationTypeSchema.safeParse(docId.slice(colon + 1));
  if (!type.success) return null;
  return { eventId: docId.slice(0, colon), notificationType: type.data };
}
