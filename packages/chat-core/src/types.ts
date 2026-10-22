export type ChatId = string;

export type ChatThreadV1 = {
  participantUserIds?: string[];
  createdAt: number;
  lastMessageAt: number;
  status?: string;
  meta?: Record<string, unknown>;
};

export type ChatMessageV1 = {
  messageId: string;
  threadId: string;
  createdAt: number;
  senderId: string;
  text?: string;
  type?: string;
  isSystemMessage?: boolean;
  referencedUids?: string[];
  hidden?: boolean;
  meta?: Record<string, unknown>;
};

export type ModerationHandlers = {
  onReportMessage?: (messageId: string, reason?: string) => void | Promise<void>;
  onReportThread?: (threadId: string, reason?: string) => void | Promise<void>;
};

export const GROUP_GAP_SEC = 120;

export type ChatMessageGroupKey = (m: ChatMessageV1) => string | undefined;

export type ChatNameResolution =
  | { status: 'resolved'; name: string }
  | { status: 'pending' }
  | { status: 'unavailable' }
  | { status: 'failed'; retry: () => void };

export type ChatNameResolver = (senderId: string) => ChatNameResolution;

export type ChatPrewarmSenders = (senderIds: string[]) => void;
