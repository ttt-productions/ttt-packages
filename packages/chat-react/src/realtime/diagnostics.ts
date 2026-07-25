// OPT-IN structured client diagnostics for the realtime chat transport.
//
// The E2E/browser harness can already capture the raw WebSocket frames; what it
// cannot see is what the CLIENT DECIDED about them — which frame it applied,
// which it dropped and why, what resume cursor it sent, whether an attachment
// row mutated in place, and whether a send was reconciled or failed. This module
// is that missing half: a bounded, structured, opt-in decision log.
//
// Rules this module exists to enforce:
//   - OFF BY DEFAULT and zero behavior change. When the option is absent the
//     factory returns `null`, every call site is `this.diag?.(...)`, and JS
//     optional-call short-circuiting means the payload object is never even
//     constructed. The cost when off is one nullish check.
//   - NEVER user content. Ids, seqs, states, counts, codes, booleans only —
//     never message text, captions, filenames, URLs, tokens, or previews. The
//     INBOX events go one step further and log SIZES only: a `channelRef` names
//     one specific conversation, so registry/unread lines carry counts and
//     deltas, never the refs themselves.
//   - STABLE event names (`chat_client_*`) suitable for log queries and later
//     alert metrics; one line per DECISION, never per render or per heartbeat.
//   - A diagnostics sink can never break the client: every emit is wrapped, so a
//     throwing sink is swallowed rather than turned into a transport failure.

/**
 * A structured diagnostic sink. `event` is one of the stable
 * {@link CHAT_CLIENT_DIAGNOSTIC_EVENTS} names; `data` is a compact, content-free
 * payload (ids/seqs/states/counts/codes only). Supplying a sink lets the app
 * route entries into its own logger; `true` uses the console.debug default.
 */
export type ChatClientDiagnosticsSink = (event: string, data: Record<string, unknown>) => void;

/**
 * The additive `diagnostics` config value: `false`/absent = off (the default and
 * the only production posture), `true` = the single-line `console.debug` sink,
 * or a custom {@link ChatClientDiagnosticsSink}.
 */
export type ChatClientDiagnosticsOption = boolean | ChatClientDiagnosticsSink;

/** The bound emitter, or `null` when diagnostics are off (the zero-overhead path). */
export type ChatClientDiagnosticsEmitter = ChatClientDiagnosticsSink | null;

/**
 * Stable event names. These are a QUERY CONTRACT — Cloud Logging filters, E2E
 * console greps, and any later alert metric key on them, so a name is added or
 * retired deliberately, never renamed in place.
 */
export const CHAT_CLIENT_DIAGNOSTIC_EVENTS = {
  /** A socket open is being attempted (per attempt, with the reconnect cause). */
  CONNECT_ATTEMPT: 'chat_client_connect_attempt',
  /** The grant mint failed before a socket existed (terminal vs. retryable). */
  GRANT_FAILED: 'chat_client_grant_failed',
  /** The socket reached OPEN (the point the resume cursor is sent from). */
  SOCKET_OPEN: 'chat_client_socket_open',
  /** The socket closed, with the code and what the client decided to do next. */
  SOCKET_CLOSE: 'chat_client_socket_close',
  /** A reconnect was scheduled (`delayMs`) or given up on (`delayMs: null`). */
  RECONNECT_SCHEDULED: 'chat_client_reconnect_scheduled',
  /** The resume cursor sent to the DO. */
  RESUME_REQUEST: 'chat_client_resume_request',
  /** The DO's snapshot answer + how the cursor moved because of it. */
  RESUME_RESULT: 'chat_client_resume_result',
  /** A `resync: true` snapshot dropped the local tail (removal, not upsert). */
  RESYNC_DROPPED_TAIL: 'chat_client_resync_dropped_tail',
  /** A frame was applied to UI state (insert / replace-by-seq / optimistic reconcile). */
  FRAME_APPLIED: 'chat_client_frame_applied',
  /** A frame was NOT applied, with the reason. */
  FRAME_DROPPED: 'chat_client_frame_dropped',
  /** An attachment lifecycle change AS SEEN BY THE CLIENT: seq, old -> new state. */
  ATTACHMENT_TRANSITION: 'chat_client_attachment_transition',
  /** A moderation revision overlay was recorded (and whether a loaded row re-rendered). */
  REVISION_APPLIED: 'chat_client_revision_applied',
  /** A history page was requested (cursor + limit). */
  HISTORY_REQUEST: 'chat_client_history_request',
  /** A history page was applied: size, seq range, cursor advance. */
  HISTORY_PAGE: 'chat_client_history_page',
  /** An optimistic send was rendered and its frame written. */
  SEND_OPTIMISTIC: 'chat_client_send_optimistic',
  /** A send was acked by the server (seq assigned). */
  SEND_ACK: 'chat_client_send_ack',
  /** A correlated `send-rejected` (or its legacy uncorrelated form) was handled. */
  SEND_REJECTED: 'chat_client_send_rejected',
  /** A send was re-emitted (reconnect resume / scheduled hint / manual retry). */
  SEND_RETRY: 'chat_client_send_retry',
  /** A send reached its visible failed state, with the reason. */
  SEND_FAILED: 'chat_client_send_failed',
  /** An uncorrelated server `error` frame code. */
  ERROR_FRAME: 'chat_client_error_frame',

  // ---- inbox socket (one per USER, separate from the per-thread channel socket) ----

  /** An inbox socket open is being attempted (per attempt, with the reconnect cause). */
  INBOX_CONNECT_ATTEMPT: 'chat_client_inbox_connect_attempt',
  /** The inbox grant mint failed before a socket existed (terminal vs. retryable). */
  INBOX_GRANT_FAILED: 'chat_client_inbox_grant_failed',
  /** The inbox socket reached OPEN (the point `resume` is sent from). */
  INBOX_SOCKET_OPEN: 'chat_client_inbox_socket_open',
  /** The inbox socket closed, with the code and what the client decided to do next. */
  INBOX_SOCKET_CLOSE: 'chat_client_inbox_socket_close',
  /** An inbox reconnect was scheduled (`delayMs`) or given up on (`delayMs: null`). */
  INBOX_RECONNECT_SCHEDULED: 'chat_client_inbox_reconnect_scheduled',
  /** The cursorless inbox `resume` was sent (the DO answers with a full snapshot). */
  INBOX_RESUME_REQUEST: 'chat_client_inbox_resume_request',
  /** An authoritative inbox snapshot was applied — registry SIZES only, never refs. */
  INBOX_SNAPSHOT_APPLIED: 'chat_client_inbox_snapshot_applied',
  /** The unread projection actually CHANGED (dock dot and/or per-row dot count). */
  INBOX_UNREAD_UPDATED: 'chat_client_inbox_unread_updated',
  /** An inbox frame was NOT applied, with the reason. */
  INBOX_FRAME_DROPPED: 'chat_client_inbox_frame_dropped',
  /** A mark-read was written to the socket (no optimistic local clear). */
  INBOX_MARK_READ: 'chat_client_inbox_mark_read',
} as const;

export type ChatClientDiagnosticEventName =
  (typeof CHAT_CLIENT_DIAGNOSTIC_EVENTS)[keyof typeof CHAT_CLIENT_DIAGNOSTIC_EVENTS];

/** Max length of a server-supplied label (frame type, error code) we echo into a log line. */
const MAX_LABEL_LEN = 48;

/**
 * Clamp a server-supplied label before it enters a log line. Frame types and
 * error codes are protocol tokens, not user content, but they arrive from the
 * wire — bound them so a hostile/buggy peer cannot emit an unbounded line.
 */
export function safeDiagnosticLabel(raw: unknown): string {
  if (typeof raw !== 'string') return 'unknown';
  const trimmed = raw.slice(0, MAX_LABEL_LEN);
  return trimmed.length > 0 ? trimmed : 'unknown';
}

/**
 * The default sink: ONE `console.debug` line per decision, shaped
 * `chat_client_<event> {"compact":"json"}` so a browser console capture or a log
 * query can filter on the stable prefix and parse the payload without a
 * multi-line join.
 */
const consoleDebugSink: ChatClientDiagnosticsSink = (event, data) => {
  if (typeof console === 'undefined' || typeof console.debug !== 'function') return;
  console.debug(`${event} ${JSON.stringify(data)}`);
};

/**
 * Build the emitter for a `diagnostics` config value. Returns `null` when
 * diagnostics are off so call sites can use `this.diag?.(...)` — with optional
 * call syntax the argument object is not constructed at all on the off path.
 */
export function createDiagnosticsEmitter(
  option: ChatClientDiagnosticsOption | undefined,
): ChatClientDiagnosticsEmitter {
  if (option == null || option === false) return null;
  const sink = option === true ? consoleDebugSink : option;
  return (event, data) => {
    // Diagnostics observe; they must never alter transport behavior — a sink that
    // throws (or a payload that cannot be serialized) is swallowed here.
    try {
      sink(event, data);
    } catch {
      /* diagnostics are never allowed to fail the client */
    }
  };
}
