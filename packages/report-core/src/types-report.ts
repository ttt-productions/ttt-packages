// Canonical content-report types.

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
