// Content moderation types: Reports, Violations, Media processing

export type FileOrigin =
  | 'profilePicture'
  | 'skill'
  | 'streetz'
  | 'job-posting'
  | 'job-reply'
  | 'opportunity-prompt'
  | 'opportunity-reply'
  | 'library-cover-tales'
  | 'library-cover-tunes'
  | 'library-cover-television'
  | 'library-cover-square'
  | 'library-cover-poster'
  | 'library-cover-cinematic'
  | 'chapter-photo'
  | 'song-photo'
  | 'song-audio'
  | 'show-photo'
  | 'show-video'
  | 'chat-attachment';

export interface PendingFile {
  id: string;
  userId: string;
  fileOrigin: FileOrigin;
  originalFileName: string;
  pendingStoragePath: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'rejected';
  createdAt: number;
  errorMessage?: string;
  targetInfo?: any;
  targetDocPath?: string;
  targetFields?: { [key: string]: string };
  textContent?: string;
}

export interface ContentViolation {
  id: string;
  userId: string;
  displayName: string;
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
  reviewedByUsername?: string;
  reviewedAt?: number;
  reviewDecision?: 'approved' | 'denied';
  reviewNotes?: string;
  pendingFile: Partial<PendingFile>;
}

// --- Reporting ---

export type Report = {
  reportId: string;
  reporterUserId: string;
  reporterUsername: string;
  reportedItemType: string;
  reportedItemId: string;
  parentItemId?: string;
  reportedUserId?: string;
  reportedUsername?: string;
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
  reportedUsername: string | null;
  reportedUserId: string | null;
  lastReportAt: number;
  totalReports: number;
  status: 'pending' | 'reviewing' | 'resolved';
  reports?: Report[];
};
