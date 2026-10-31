export { processBatchHelper } from './processBatchHelper.js';
export { NotificationPermissionError } from './errors.js';
export { buildActiveNotificationDocId } from './activeNotificationId.js';

export { createDeliveryLedger, applyAggregation } from './delivery-ledger.js';
export type {
  DeliveryLedger,
  DeliveryRowInput,
  DeliveryPayload,
  DeliveryState,
  DeliverySkipReason,
  DeliveryLedgerOptions,
  AggregationStrategy,
  MaterializationClass,
  EnqueueResult,
  EnqueueRowResult,
  MaterializeOutcome,
  MaterializeManyOptions,
  ReplayOutcome,
  ReplayOptions,
  ReplacedDelivery,
} from './delivery-ledger.js';

export {
  markNotificationSeenWithGeneration,
  archiveNotificationWithGeneration,
} from './observed-generation.js';
export type { MarkSeenOutcome, ArchiveOutcome } from './observed-generation.js';
