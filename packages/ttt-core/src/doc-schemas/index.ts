// Barrel for the Firestore document SCHEMAS (Zod) and the collection registry.
// Exposed on the `@ttt-productions/ttt-core/doc-schemas` subpath. The schema registry
// (COLLECTION_SCHEMAS) is consumed by the schema-doc generator (ttt-packages) and the
// drift-check (ttt-prod). Document TYPES are inferred from these schemas and surface on
// the main barrel via ../types/*; this subpath is the home of the runtime schemas.

export * from './user.js';
export * from './firestore-primitives.js';
export * from './media-assets.js';
export * from './media-activation-jobs.js';
export * from './publicUser.js';
export * from './account-deletion.js';
export * from './work-project.js';
export * from './content.js';
export * from './social.js';
export * from './payments.js';
export * from './commissions.js';
export * from './messaging.js';
export * from './system.js';
export * from './moderation.js';
export * from './report-docs.js';
export * from './audit.js';
export * from './notifications.js';
export * from './notification-ledger.js';
export * from './chat-sync.js';
export * from './operational.js';

// ===== Trust & Safety — shared foundation + cluster schemas (§A1–A11) =====
export * from './safety/foundation.js';
export * from './safety/report.js';
export * from './safety/case.js';
export * from './safety/case-aliases.js';
export * from './safety/holds.js';
export * from './safety/evidence.js';
export * from './safety/provenance.js';
export * from './safety/sagas.js';
export * from './safety/monitors.js';
export * from './safety/age.js';

// ===== Trust & Safety — NCII / TAKE IT DOWN (§A11) =====
export * from './ncii/allegations.js';
export * from './ncii/requests.js';
export * from './ncii/cases.js';
export * from './ncii/holds.js';
export * from './ncii/removal.js';
export * from './ncii/scan.js';
export * from './ncii/appeals.js';
export * from './ncii/notices.js';
export * from './ncii/config.js';

export * from './registry.js';
