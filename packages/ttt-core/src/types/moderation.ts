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
