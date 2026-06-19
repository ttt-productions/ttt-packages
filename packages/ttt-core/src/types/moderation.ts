// Content moderation types: Violations, Content appeals.
// (The report DOC shapes are the Trust & Safety report spine — ProtectedReportRootV1 /
//  ReportPublicProjectionV1 / ReportGroupV1 in ../doc-schemas/safety/report.ts.)

// Shapes are defined as Zod schemas in ../doc-schemas/moderation.ts (single source of truth).
export type {
  ContentViolation,
  ContentAppealTask,
  ModerationCascadeAction,
  ModerationCascadeStatus,
  ModerationCascadeChangedEntityType,
  ModerationCascadeManifestEntityType,
  ModerationCascadeManifest,
  ModerationCascadeChangedDoc,
} from '../doc-schemas/moderation.js';
