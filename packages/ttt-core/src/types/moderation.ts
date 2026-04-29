// Content moderation types: Reports, Violations, Media processing

import type { PendingMediaPending } from '@ttt-productions/media-contracts';

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
  status: 'pending_review' | 'resolved_no_action' | 'resolved_action_taken';
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
  status: 'pending' | 'reviewing' | 'resolved';
  reports?: Report[];
};

export interface ContentAppealTask {
  id: string;
  taskType: 'content-appeal';
  violationId: string;
  userId: string;
  fileType: string;
  rejectionReason: string;
  appealMessage: string;
  rejectedFilePath: string;
  status: 'pending' | 'checked-out' | 'completed';
  checkedOutBy?: string;
  checkedOutAt?: number;
  createdAt: number;
  priority: 'normal' | 'high';
}
