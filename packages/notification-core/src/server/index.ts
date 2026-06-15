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

// Delivery ledger (notification redesign — P1)
export { createDeliveryLedger, applyAggregation } from './delivery-ledger.js';
export type {
  DeliveryLedger,
  DeliveryRowInput,
  DeliveryPayload,
  DeliveryState,
  AggregationStrategy,
  MaterializationClass,
  EnqueueResult,
  EnqueueRowResult,
  MaterializeOutcome,
} from './delivery-ledger.js';

// Observed-generation seen/archive protocol (notification redesign — P1)
export {
  markNotificationSeenWithGeneration,
  archiveNotificationWithGeneration,
} from './observed-generation.js';
export type { MarkSeenOutcome, ArchiveOutcome } from './observed-generation.js';

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
