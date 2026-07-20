// Server-side helpers (for Cloud Functions).
// NOTE: report WRITE + grouping is no longer owned here — the consuming app's
// `submitReport` callable writes the protected report root + public projection, and a
// separate app trigger maintains the report group. report-core keeps only the generic
// admin-task QUEUE machinery below.
export { createAdminTaskHandler } from './createAdminTaskHandler.js';
export type { AdminTaskHandlerConfig } from './createAdminTaskHandler.js';

export { createCheckoutTaskHandler } from './createCheckoutTaskHandler.js';
export type { CheckoutTaskHandlerConfig } from './createCheckoutTaskHandler.js';

export { createCheckinTaskHandler } from './createCheckinTaskHandler.js';
export type { CheckinTaskHandlerConfig } from './createCheckinTaskHandler.js';

export { createReleaseTaskHandler } from './createReleaseTaskHandler.js';
export type { ReleaseTaskHandlerConfig } from './createReleaseTaskHandler.js';

export { createCheckoutNextImportantHandler } from './createCheckoutNextImportantHandler.js';
export type { CheckoutNextImportantHandlerConfig } from './createCheckoutNextImportantHandler.js';

export { calculatePriorityScore, getHighestScoringReason } from './calculatePriorityScore.js';

// Typed failure channel: expected queue outcomes carry an HttpsError-shaped code
// for the consuming callable to map 1:1 (see taskError.ts).
export { ReportCoreTaskError } from './taskError.js';
export type { ReportCoreTaskErrorCode } from './taskError.js';

// Server types
export type {
  AdminAuthConfig,
  OnAuditEvent,
  ReportCoreAuditEvent,
  ServerCollectionRef,
  ServerDocRef,
  ServerDocSnapshot,
  ServerFieldValue,
  ServerFirestore,
  ServerQuery,
  ServerQuerySnapshot,
  ServerReportCoreConfig,
  ServerTransaction,
  ServerWriteBatch,
} from './types.js';
