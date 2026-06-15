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
export * from './operational.js';
export * from './registry.js';
