// Content moderation types: Reports, Violations, Media processing

import type { PendingMediaPending } from '@ttt-productions/media-contracts';
import type { AdminTask } from './admin.js';

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

// --- Reporting ---

export type ReportStatus =
  | 'pending_review'
  | 'resolved_no_action'
  | 'resolved_action_taken';

export type ReportGroupStatus = 'pending' | 'reviewing' | 'resolved';

export type Report = {
  reportId: string;
  reporterUserId: string;
  reportedItemType: string;
  reportedItemId: string;
  parentItemId?: string;
  reportedUserId?: string;
  reason: string;
  comment: string;
  createdAt: number;
  status: ReportStatus;
  resolvedAt?: number;
  resolvedBy?: string;
  adminNotes?: string;
};

export type ReportGroup = {
  groupKey: string;
  reportedItemId: string;
  reportedItemType: string;
  reportedUserId: string | null;
  lastReportAt: number;
  totalReports: number;
  status: ReportGroupStatus;
  reports?: Report[];
};

export interface ContentAppealTask extends AdminTask {
  taskType: 'content-appeal';
  // Appeal-specific denormalized fields for the preview/work view.
  violationId: string;
  userId: string;
  fileType: string;
  rejectionReason: string;
  appealMessage: string;
  rejectedFilePath: string;
}
