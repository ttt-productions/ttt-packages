export type ChatClientDiagnosticsSink = (event: string, data: Record<string, unknown>) => void;

export type ChatClientDiagnosticsOption = boolean | ChatClientDiagnosticsSink;

export type ChatClientDiagnosticsEmitter = ChatClientDiagnosticsSink | null;

// Log queries key on these names: add or retire one, never rename it in place.
export const CHAT_CLIENT_DIAGNOSTIC_EVENTS = {
  CONNECT_ATTEMPT: 'chat_client_connect_attempt',
  GRANT_FAILED: 'chat_client_grant_failed',
  SOCKET_OPEN: 'chat_client_socket_open',
  SOCKET_CLOSE: 'chat_client_socket_close',
  SOCKET_LIVENESS_TIMEOUT: 'chat_client_socket_liveness_timeout',
  RECONNECT_SCHEDULED: 'chat_client_reconnect_scheduled',
  RESUME_REQUEST: 'chat_client_resume_request',
  RESUME_RESULT: 'chat_client_resume_result',
  RESYNC_DROPPED_TAIL: 'chat_client_resync_dropped_tail',
  FRAME_APPLIED: 'chat_client_frame_applied',
  FRAME_DROPPED: 'chat_client_frame_dropped',
  REVISION_APPLIED: 'chat_client_revision_applied',
  HISTORY_REQUEST: 'chat_client_history_request',
  HISTORY_PAGE: 'chat_client_history_page',
  SEND_OPTIMISTIC: 'chat_client_send_optimistic',
  SEND_ACK: 'chat_client_send_ack',
  SEND_REJECTED: 'chat_client_send_rejected',
  SEND_RETRY: 'chat_client_send_retry',
  SEND_FAILED: 'chat_client_send_failed',
  ERROR_FRAME: 'chat_client_error_frame',

  INBOX_CONNECT_ATTEMPT: 'chat_client_inbox_connect_attempt',
  INBOX_GRANT_FAILED: 'chat_client_inbox_grant_failed',
  INBOX_SOCKET_OPEN: 'chat_client_inbox_socket_open',
  INBOX_SOCKET_CLOSE: 'chat_client_inbox_socket_close',
  INBOX_RECONNECT_SCHEDULED: 'chat_client_inbox_reconnect_scheduled',
  INBOX_RESUME_REQUEST: 'chat_client_inbox_resume_request',
  INBOX_SNAPSHOT_APPLIED: 'chat_client_inbox_snapshot_applied',
  INBOX_UNREAD_UPDATED: 'chat_client_inbox_unread_updated',
  INBOX_FRAME_DROPPED: 'chat_client_inbox_frame_dropped',
  INBOX_MARK_READ: 'chat_client_inbox_mark_read',
} as const;

export type ChatClientDiagnosticEventName =
  (typeof CHAT_CLIENT_DIAGNOSTIC_EVENTS)[keyof typeof CHAT_CLIENT_DIAGNOSTIC_EVENTS];

const MAX_LABEL_LEN = 48;

export function safeDiagnosticLabel(raw: unknown): string {
  if (typeof raw !== 'string') return 'unknown';
  const trimmed = raw.slice(0, MAX_LABEL_LEN);
  return trimmed.length > 0 ? trimmed : 'unknown';
}

const consoleDebugSink: ChatClientDiagnosticsSink = (event, data) => {
  if (typeof console === 'undefined' || typeof console.debug !== 'function') return;
  console.debug(`${event} ${JSON.stringify(data)}`);
};

export function createDiagnosticsEmitter(
  option: ChatClientDiagnosticsOption | undefined,
): ChatClientDiagnosticsEmitter {
  if (option == null || option === false) return null;
  const sink = option === true ? consoleDebugSink : option;
  return (event, data) => {
    // RULE-STD-ENG-009 exception: diagnostics must never fail the client, so a throwing sink is
    // swallowed.
    try {
      sink(event, data);
    } catch {}
  };
}
