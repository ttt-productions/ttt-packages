// Content moderation types: Violations, Content appeals.
// (Reports/ReportGroup/ReportStatus moved to @ttt-productions/report-core.)

import type { PendingMediaPending } from '../media/pending-media.js';
import type { AdminTask } from '@ttt-productions/report-core';

export interface ContentViolation {
  id: string;
  userId: string;
  fileType: string;
  violationType?: 'text' | 'media';
  originalFileName: string;
  reason: string;
  scores: {
    adult: string;
    violence: string;
    racy: string;
  };
  timestamp: number;
  rejectedFilePath: string;
  rejectedFileUrl?: string;
  appealStatus: 'none' | 'pending' | 'approved' | 'denied';
  appealMessage?: string;
  appealedAt?: number;
  reviewedBy?: string;
  reviewedAt?: number;
  reviewDecision?: 'approved' | 'denied';
  reviewNotes?: string;
  pendingFile: Partial<PendingMediaPending>;
}

export interface ContentAppealTask extends AdminTask<'content-appeal'> {
  // Appeal-specific denormalized fields for the preview/work view.
  violationId: string;
  userId: string;
  fileType: string;
  rejectionReason: string;
  appealMessage: string;
  rejectedFilePath: string;
}

// ===== Moderation cascade manifests =====
// Persisted record of a Realm hide/restore cascade so a restore reverts ONLY the
// exact child docs the matching hide cascade changed. See
// docs/design/work-realm-discovery-system.md (§13) and content-moderation-and-reporting.md.

export type ModerationCascadeAction = 'hideRealm' | 'restoreRealm';
export type ModerationCascadeStatus = 'pending' | 'complete' | 'failed';
export type ModerationCascadeChangedEntityType = 'workProject' | 'hallItem' | 'subItemProjection';

// moderationCascadeManifests/{cascadeId}
export type ModerationCascadeManifest = {
  cascadeId: string;
  action: ModerationCascadeAction;
  entityType: 'workRealm';
  entityId: string;
  actorUid: string;
  reason: string;
  createdAt: number;
  completedAt?: number;
  status: ModerationCascadeStatus;
};

// moderationCascadeManifests/{cascadeId}/changedDocs/{changedDocId}
// Launch cascades only toggle hidden booleans; previousValue/newValue are the prior
// and applied values of fieldPath on the changed doc.
export type ModerationCascadeChangedDoc = {
  docPath: string;
  entityType: ModerationCascadeChangedEntityType;
  fieldPath: string;
  previousValue: boolean;
  newValue: boolean;
  restored: boolean;
  restoredAt?: number;
};
