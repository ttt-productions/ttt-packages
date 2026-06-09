// Content moderation types: Violations, Content appeals.
// (Reports/ReportGroup/ReportStatus moved to @ttt-productions/report-core.)

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
