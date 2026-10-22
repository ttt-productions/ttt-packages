export interface SeqAllocatorRow {
  id: string;
  lastSeq: number;
}

export interface MessageRevAllocatorRow {
  id: string;
  lastRevision: number;
}

export interface UnreadProjectionRow {
  recipientUid: string;
  unread: number;
  lastEmittedProjectionEventId: string | null;
  dueWorkState: string | null;
  focusLeaseUntil: number | null;
  focusLeaseMaxUntil: number | null;
}

export interface OutboxRow {
  id: string;
  kind: string;
  payload: string;
  status: 'pending' | 'delivered' | 'deadLetter';
  attemptCount: number;
  nextAttemptAt: number;
  lastError: string | null;
  createdAt: number;
}
