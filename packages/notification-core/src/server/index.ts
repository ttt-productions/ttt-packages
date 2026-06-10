// Server-side helpers (for Cloud Functions)
export { createNotificationHelper } from './createNotificationHelper.js';
export { processBatchHelper } from './processBatchHelper.js';
export {
  archiveNotificationHelper,
  archiveAllNotificationsHelper,
} from './archiveNotificationHelper.js';
export { markSeenHelper } from './markSeenHelper.js';
export { NotificationPermissionError } from './errors.js';
export { buildActiveNotificationDocId } from './activeNotificationId.js';

// Server types
export type {
  ServerFirestore,
  ServerCollectionRef,
  ServerQuery,
  ServerQuerySnapshot,
  ServerDocSnapshot,
  ServerDocRef,
  ServerWriteBatch,
  ServerTransaction,
  CreateNotificationInput,
  NotificationHelper,
} from './types.js';
