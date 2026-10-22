import {
  createReconnectController,
  type ReconnectController,
} from '@ttt-productions/realtime-core';
import type { ChatMessageV1 } from '@ttt-productions/chat-core';
import {
  CLIENT_KINDS,
  CHAT_CLOSE_CODES,
  ChatSendRejectedPayloadSchema,
  HEARTBEAT_MS,
  TYPING_COALESCE_MS,
  HISTORY_PAGE_MAX,
} from '@ttt-productions/chat-schemas';
import {
  buildFrame,
  parseFrame,
  isInboxSnapshot,
  type WireMessageRow,
  type WireChannelSnapshot,
  type RevisionKind,
} from './wire.js';
import type {
  ChatHistoryPayload,
  ChatReadAckPayload,
  ChatResumePayload,
  ChatSendPayload,
  ClientFrameKind,
  ChatSendRejectionCode,
} from '@ttt-productions/chat-schemas';
import type { RealtimeSocket, SocketFactory } from './socket.js';
import {
  wireRowToMessage,
  optimisticMessage,
  seqToMessageId,
  applyModerationOverlay,
  overlayFromRow,
  type ModerationOverlay,
} from './map.js';
import type { GrantProvider, TransportTimers, RealtimeStatus } from './shared.js';
import {
  createDiagnosticsEmitter,
  safeDiagnosticLabel,
  CHAT_CLIENT_DIAGNOSTIC_EVENTS as DIAG,
  type ChatClientDiagnosticsEmitter,
  type ChatClientDiagnosticsOption,
} from './diagnostics.js';
import {
  defaultTimers,
  isChatAccessDeniedError,
  isTerminalErrorCode,
  TERMINAL_ERROR_CODE,
  MAX_PENDING_SEND_ATTEMPTS,
  PENDING_SEND_MAX_AGE_MS,
  SERVER_RETRYABLE_MAX_AGE_MS,
  SEND_RETRY_MIN_DELAY_MS,
  SEND_RETRY_MAX_DELAY_MS,
} from './shared.js';
import { InitialLoadBudget } from './initial-load-budget.js';

type ChannelFramePayload<K extends ClientFrameKind> = K extends typeof CLIENT_KINDS.SEND
  ? ChatSendPayload
  : K extends typeof CLIENT_KINDS.READ_ACK
    ? ChatReadAckPayload
    : K extends typeof CLIENT_KINDS.HISTORY
      ? ChatHistoryPayload
      : K extends typeof CLIENT_KINDS.RESUME
        ? ChatResumePayload
        : Record<string, never>;

interface PendingSend {
  clientMessageId: string;
  text: string;
  sentAt: number;
  attempts: number;
  failed: boolean;
  serverRetryable: boolean;
  lastRejectionCode?: ChatSendRejectionCode;
  retryTimer: ReturnType<TransportTimers['setTimeout']> | null;
}

export interface ChannelClientState {
  status: RealtimeStatus;
  messages: ChatMessageV1[];
  typing: string[];
  presence: string[];
  isFetchingOlder: boolean;
  hasOlder: boolean;
  lastErrorCode: string | null;
  hasLoadedInitialData: boolean;
  initialLoadFailed: boolean;
  isSynced: boolean;
}

export interface ChannelClientConfig {
  endpoint: string;
  threadId: string;
  currentUserId: string;
  grantProvider: GrantProvider;
  socketFactory: SocketFactory;
  timers?: TransportTimers;
  reconnect?: {
    baseDelayMs?: number;
    maxDelayMs?: number;
    maxAttempts?: number | null;
    random?: () => number;
  };
  diagnostics?: ChatClientDiagnosticsOption;
}

const INITIAL: ChannelClientState = {
  status: 'idle',
  messages: [],
  typing: [],
  presence: [],
  isFetchingOlder: false,
  hasOlder: true,
  lastErrorCode: null,
  hasLoadedInitialData: false,
  initialLoadFailed: false,
  isSynced: false,
};

const MEMBERSHIP_PENDING_CODE = 'membership-pending';

type HistoryRequestKind = 'resync' | 'older';
const MEMBERSHIP_PENDING_DEFAULT_RETRY_MS = 2000;

// Sound only on the channel socket: its DO auto-answers every heartbeat, so silence this long
// means a half-open socket. A healthy idle inbox socket is silent for hours.
const INBOUND_SILENCE_LIMIT_MS = 50_000;

// Browser `WebSocket.close()` accepts only 1000 or 3000–4999, and 4xxx belongs to the chat wire.
const WATCHDOG_CLOSE_CODE = 1000;

export class ChannelClient {
  private readonly timers: TransportTimers;
  private readonly controller: ReconnectController;
  private socket: RealtimeSocket | null = null;
  private state: ChannelClientState = INITIAL;
  private readonly listeners = new Set<(s: ChannelClientState) => void>();

  private resumeSeq = 0;
  private lastReadAck: { readSeq: number; focused: boolean } | null = null;
  private reauthAttempted = false;
  private presenceSubscribed = false;
  private heartbeatTimer: ReturnType<TransportTimers['setTimeout']> | null = null;
  private lastInboundAt: number | null = null;
  private historyRequests: HistoryRequestKind[] = [];
  private typingTimers = new Map<string, ReturnType<TransportTimers['setTimeout']>>();
  private lastTypingSentAt = Number.NEGATIVE_INFINITY;
  private reconnectTimer: ReturnType<TransportTimers['setTimeout']> | null = null;
  private membershipRetryTimer: ReturnType<TransportTimers['setTimeout']> | null = null;
  private closedByUs = false;
  private lifecycle = 0;
  private readonly initialLoad: InitialLoadBudget;
  private overlays = new Map<number, ModerationOverlay>();
  private originalRows = new Map<number, ChatMessageV1>();
  private pendingSends = new Map<string, PendingSend>();
  private readonly diag: ChatClientDiagnosticsEmitter;
  private connectAttempt = 0;
  private reconnectCause:
    'initial' | 'auth-expired' | 'transient-close' | 'grant-error' | 'manual-retry' = 'initial';
  private lastCloseCode: number | null = null;

  constructor(private readonly config: ChannelClientConfig) {
    this.timers = config.timers ?? defaultTimers;
    this.controller = createReconnectController(config.reconnect ?? {});
    this.diag = createDiagnosticsEmitter(config.diagnostics);
    this.initialLoad = new InitialLoadBudget(this.timers, () => this.reportInitialLoadFailed());
  }

  getState(): ChannelClientState {
    return this.state;
  }

  subscribe(fn: (s: ChannelClientState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setState(patch: Partial<ChannelClientState>): void {
    this.state = { ...this.state, ...patch };
    if (this.state.status !== 'open') this.state.isSynced = false;
    for (const fn of this.listeners) fn(this.state);
  }

  async connect(): Promise<void> {
    return this.startLifecycle(true);
  }

  retryNow(): void {
    if (!this.state.hasLoadedInitialData) this.initialLoad.manualRetry();
    if (this.state.status === 'closed') {
      void this.startLifecycle(false);
      return;
    }
    if (this.reconnectTimer == null) {
      if (this.state.initialLoadFailed) this.setState({ initialLoadFailed: false });
      return;
    }
    this.timers.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.controller.reset();
    this.controller.start();
    this.reconnectCause = 'manual-retry';
    this.setState({ status: 'reconnecting', initialLoadFailed: false });
    void this.openSocket();
  }

  private async startLifecycle(freshBudget: boolean): Promise<void> {
    if (this.state.status !== 'idle' && this.state.status !== 'closed') return;
    this.controller.reset();
    if (isTerminalErrorCode(this.state.lastErrorCode)) this.setState({ lastErrorCode: null });
    this.closedByUs = false;
    this.lifecycle += 1;
    this.reconnectCause = 'initial';
    if (!this.state.hasLoadedInitialData) this.initialLoad.begin(freshBudget);
    this.controller.start();
    this.setState({ status: 'connecting', initialLoadFailed: false });
    await this.openSocket();
  }

  private reportInitialLoadFailed(): void {
    if (this.state.hasLoadedInitialData || this.state.initialLoadFailed) return;
    this.setState({ initialLoadFailed: true });
  }

  private initialDataLoaded(): Partial<ChannelClientState> {
    this.initialLoad.loaded();
    return { hasLoadedInitialData: true, initialLoadFailed: false };
  }

  private async openSocket(): Promise<void> {
    const lifecycle = this.lifecycle;
    this.connectAttempt += 1;
    this.diag?.(DIAG.CONNECT_ATTEMPT, {
      attempt: this.connectAttempt,
      cause: this.reconnectCause,
      closeCode: this.lastCloseCode,
      resumeSeq: this.resumeSeq,
      pendingSends: this.pendingSends.size,
    });
    let grantToken: string;
    try {
      grantToken = await this.config.grantProvider();
    } catch (err) {
      if (lifecycle !== this.lifecycle) return;
      const terminal = isChatAccessDeniedError(err);
      this.diag?.(DIAG.GRANT_FAILED, { attempt: this.connectAttempt, terminal });
      if (terminal) return this.denyAccessTerminally();
      this.reconnectCause = 'grant-error';
      if (!this.state.hasLoadedInitialData) this.initialLoad.noteFailedAttempt();
      return this.scheduleReconnect();
    }
    if (lifecycle !== this.lifecycle || this.closedByUs) return;
    this.lastInboundAt = null;
    const url = `${this.config.endpoint.replace(/\/$/, '')}/channel`;
    let socket: RealtimeSocket | null = null;
    const isCurrent = () => socket !== null && this.socket === socket;
    socket = this.config.socketFactory({
      url,
      grantToken,
      handlers: {
        onOpen: () => {
          if (isCurrent()) this.onOpen();
        },
        onMessage: (data) => {
          if (isCurrent()) this.onMessage(data);
        },
        onClose: (code, reason) => {
          if (isCurrent()) this.onClose(code, reason);
        },
        onError: () => {
          if (isCurrent()) this.onError();
        },
      },
    });
    this.socket = socket;
  }

  private onOpen(): void {
    this.controller.onOpen();
    this.reauthAttempted = false;
    this.lastInboundAt = this.timers.now();
    this.historyRequests = [];
    this.setState({ status: 'open', isSynced: false });
    this.diag?.(DIAG.SOCKET_OPEN, {
      attempt: this.connectAttempt,
      cause: this.reconnectCause,
      resumeSeq: this.resumeSeq,
      pendingSends: this.pendingSends.size,
      presenceSubscribed: this.presenceSubscribed,
    });
    this.sendFrame(CLIENT_KINDS.RESUME, { afterSeq: this.resumeSeq });
    this.diag?.(DIAG.RESUME_REQUEST, { afterSeq: this.resumeSeq, attempt: this.connectAttempt });
    if (this.presenceSubscribed) this.sendFrame(CLIENT_KINDS.PRESENCE_SUBSCRIBE, {});
    if (this.lastReadAck) this.sendFrame(CLIENT_KINDS.READ_ACK, { ...this.lastReadAck });
    this.resendPendingSends('reconnect');
    this.startHeartbeat();
  }

  private resendPendingSends(reason: 'reconnect' | 'membership-pending'): void {
    if (this.pendingSends.size === 0) return;
    const now = this.timers.now();
    for (const pending of [...this.pendingSends.values()]) {
      if (pending.failed) continue;
      if (pending.serverRetryable) {
        if (now - pending.sentAt >= SERVER_RETRYABLE_MAX_AGE_MS) {
          this.failPendingSend(pending.clientMessageId, pending.lastRejectionCode, true);
          continue;
        }
        this.clearSendRetryTimer(pending);
      } else {
        const tooOld = now - pending.sentAt >= PENDING_SEND_MAX_AGE_MS;
        const tooManyAttempts = pending.attempts >= MAX_PENDING_SEND_ATTEMPTS;
        if (tooOld || tooManyAttempts) {
          this.failPendingSend(pending.clientMessageId);
          continue;
        }
      }
      const sent = this.sendFrame(CLIENT_KINDS.SEND, {
        clientMessageId: pending.clientMessageId,
        text: pending.text,
      });
      if (sent) pending.attempts += 1;
      this.diag?.(DIAG.SEND_RETRY, {
        clientMessageId: pending.clientMessageId,
        reason,
        attempts: pending.attempts,
        serverRetryable: pending.serverRetryable,
        ageMs: now - pending.sentAt,
        sent,
      });
    }
  }

  private failPendingSend(
    clientMessageId: string,
    code?: ChatSendRejectionCode,
    retryable?: boolean,
  ): void {
    const pending = this.pendingSends.get(clientMessageId);
    if (!pending || pending.failed) return;
    pending.failed = true;
    this.clearSendRetryTimer(pending);
    this.diag?.(DIAG.SEND_FAILED, {
      clientMessageId,
      code: code ?? 'send-failed',
      retryable: retryable ?? null,
      attempts: pending.attempts,
      serverRetryable: pending.serverRetryable,
      ageMs: this.timers.now() - pending.sentAt,
    });
    const next = this.state.messages.map((m) =>
      m.meta?.optimistic && m.meta?.clientMessageId === clientMessageId
        ? {
            ...m,
            meta: {
              ...m.meta,
              sendFailed: true,
              ...(code ? { sendFailureCode: code } : {}),
              ...(retryable != null ? { sendRetryable: retryable } : {}),
            },
          }
        : m,
    );
    this.setState({ messages: next, lastErrorCode: code ?? 'send-failed' });
  }

  private clearSendRetryTimer(pending: PendingSend): void {
    if (pending.retryTimer != null) {
      this.timers.clearTimeout(pending.retryTimer);
      pending.retryTimer = null;
    }
  }

  private clearPendingSend(clientMessageId: string): void {
    const pending = this.pendingSends.get(clientMessageId);
    if (pending) this.clearSendRetryTimer(pending);
    this.pendingSends.delete(clientMessageId);
  }

  private scheduleMembershipPendingRetry(delayMs: number): void {
    if (this.membershipRetryTimer != null) this.timers.clearTimeout(this.membershipRetryTimer);
    this.membershipRetryTimer = this.timers.setTimeout(() => {
      this.membershipRetryTimer = null;
      if (this.closedByUs) return;
      this.resendPendingSends('membership-pending');
    }, delayMs);
  }

  private applySendRejected(payload: Record<string, unknown>): void {
    const parsed = ChatSendRejectedPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      const rawId = (payload as { clientMessageId?: unknown }).clientMessageId;
      if (typeof rawId === 'string' && rawId.length > 0 && rawId.length <= 200) {
        const orphaned = this.pendingSends.get(rawId);
        if (orphaned && !orphaned.failed) {
          this.diag?.(DIAG.SEND_REJECTED, {
            clientMessageId: rawId,
            outcome: 'unparseable-fail-closed',
          });
          this.failPendingSend(rawId);
          return;
        }
      }
      this.diag?.(DIAG.SEND_REJECTED, { clientMessageId: null, outcome: 'unparseable-dropped' });
      return;
    }
    const { clientMessageId, code, retryable, retryAfterMs } = parsed.data;
    const pending = this.pendingSends.get(clientMessageId);
    if (!pending || pending.failed) {
      this.diag?.(DIAG.SEND_REJECTED, {
        clientMessageId,
        code,
        retryable,
        outcome: 'no-pending-send',
      });
      return;
    }

    if (!retryable) {
      this.diag?.(DIAG.SEND_REJECTED, {
        clientMessageId,
        code,
        retryable: false,
        outcome: 'terminal',
      });
      this.failPendingSend(clientMessageId, code, false);
      return;
    }

    pending.serverRetryable = true;
    pending.lastRejectionCode = code;
    if (this.timers.now() - pending.sentAt >= SERVER_RETRYABLE_MAX_AGE_MS) {
      this.diag?.(DIAG.SEND_REJECTED, {
        clientMessageId,
        code,
        retryable: true,
        outcome: 'budget-exhausted',
      });
      this.failPendingSend(clientMessageId, code, true);
      return;
    }
    const delayMs = this.clampRetryDelay(retryAfterMs);
    this.diag?.(DIAG.SEND_REJECTED, {
      clientMessageId,
      code,
      retryable: true,
      outcome: 'retry-scheduled',
      delayMs,
    });
    this.scheduleSendRetry(clientMessageId, delayMs);
  }

  private scheduleSendRetry(clientMessageId: string, delayMs: number): void {
    const pending = this.pendingSends.get(clientMessageId);
    if (!pending) return;
    this.clearSendRetryTimer(pending);
    pending.retryTimer = this.timers.setTimeout(() => {
      pending.retryTimer = null;
      if (this.closedByUs) return;
      const current = this.pendingSends.get(clientMessageId);
      if (!current || current.failed) return;
      if (this.timers.now() - current.sentAt >= SERVER_RETRYABLE_MAX_AGE_MS) {
        this.failPendingSend(clientMessageId, current.lastRejectionCode, true);
        return;
      }
      const sent = this.sendFrame(CLIENT_KINDS.SEND, {
        clientMessageId: current.clientMessageId,
        text: current.text,
      });
      this.diag?.(DIAG.SEND_RETRY, {
        clientMessageId: current.clientMessageId,
        reason: 'scheduled',
        attempts: current.attempts,
        serverRetryable: current.serverRetryable,
        ageMs: this.timers.now() - current.sentAt,
        sent,
      });
      const remainingMs =
        SERVER_RETRYABLE_MAX_AGE_MS -
        (this.timers.now() - current.sentAt) +
        SEND_RETRY_MIN_DELAY_MS;
      current.retryTimer = this.timers.setTimeout(() => {
        current.retryTimer = null;
        if (this.closedByUs) return;
        const atDeadline = this.pendingSends.get(clientMessageId);
        if (!atDeadline || atDeadline.failed) return;
        if (this.timers.now() - atDeadline.sentAt >= SERVER_RETRYABLE_MAX_AGE_MS) {
          this.failPendingSend(clientMessageId, atDeadline.lastRejectionCode, true);
        }
      }, remainingMs);
    }, delayMs);
  }

  private clampRetryDelay(retryAfterMs: number | undefined): number {
    const raw =
      typeof retryAfterMs === 'number' && retryAfterMs > 0
        ? retryAfterMs
        : MEMBERSHIP_PENDING_DEFAULT_RETRY_MS;
    return Math.min(Math.max(raw, SEND_RETRY_MIN_DELAY_MS), SEND_RETRY_MAX_DELAY_MS);
  }

  private failAllPendingSends(): void {
    for (const clientMessageId of [...this.pendingSends.keys()]) {
      this.failPendingSend(clientMessageId);
    }
  }

  retrySend(clientMessageId: string): boolean {
    const pending = this.pendingSends.get(clientMessageId);
    if (!pending) return false;
    this.clearSendRetryTimer(pending);
    pending.failed = false;
    pending.serverRetryable = false;
    pending.lastRejectionCode = undefined;
    pending.sentAt = this.timers.now();
    const sent = this.sendFrame(CLIENT_KINDS.SEND, {
      clientMessageId: pending.clientMessageId,
      text: pending.text,
    });
    pending.attempts = sent ? 1 : 0;
    this.diag?.(DIAG.SEND_RETRY, {
      clientMessageId,
      reason: 'manual',
      attempts: pending.attempts,
      serverRetryable: false,
      ageMs: 0,
      sent,
    });
    const next = this.state.messages.map((m) => {
      if (!(
        m.meta?.optimistic &&
        m.meta?.clientMessageId === clientMessageId &&
        m.meta?.sendFailed
      )) {
        return m;
      }
      const {
        sendFailed: _sendFailed,
        sendFailureCode: _sendFailureCode,
        sendRetryable: _sendRetryable,
        ...restMeta
      } = m.meta;
      return { ...m, meta: { ...restMeta } };
    });
    this.setState({ messages: next, lastErrorCode: null });
    return true;
  }

  private onError(): void {
    // The close handler does the backoff; onerror is advisory in browsers.
  }

  private onClose(code: number, _reason: string): void {
    this.stopHeartbeat();
    this.socket = null;
    this.lastInboundAt = null;
    this.lastCloseCode = code;
    if (this.state.isFetchingOlder) this.setState({ isFetchingOlder: false });
    if (this.closedByUs) {
      this.diag?.(DIAG.SOCKET_CLOSE, {
        code,
        closedByUs: true,
        outcome: 'closed',
        resumeSeq: this.resumeSeq,
      });
      this.setState({ status: 'closed' });
      return;
    }
    if (code === CHAT_CLOSE_CODES.AUTH_EXPIRED && !this.reauthAttempted) {
      this.reauthAttempted = true;
      this.reconnectCause = 'auth-expired';
      this.diag?.(DIAG.SOCKET_CLOSE, {
        code,
        closedByUs: false,
        outcome: 're-grant',
        resumeSeq: this.resumeSeq,
      });
      this.setState({ status: 'reconnecting' });
      void this.openSocket();
      return;
    }
    if (code === CHAT_CLOSE_CODES.REVOKED) {
      this.closedByUs = true;
      this.controller.close();
      this.diag?.(DIAG.SOCKET_CLOSE, {
        code,
        closedByUs: false,
        outcome: 'revoked',
        resumeSeq: this.resumeSeq,
      });
      this.failAllPendingSends();
      this.setState({ status: 'closed', lastErrorCode: TERMINAL_ERROR_CODE.REVOKED });
      this.reportInitialLoadFailed();
      return;
    }
    this.reconnectCause = 'transient-close';
    if (!this.state.hasLoadedInitialData) this.initialLoad.noteFailedAttempt();
    this.diag?.(DIAG.SOCKET_CLOSE, {
      code,
      closedByUs: false,
      outcome: 'reconnect',
      resumeSeq: this.resumeSeq,
    });
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    const delay = this.controller.onClose();
    this.diag?.(DIAG.RECONNECT_SCHEDULED, {
      delayMs: delay,
      cause: this.reconnectCause,
      attempt: this.connectAttempt,
      resumeSeq: this.resumeSeq,
    });
    if (delay == null) {
      this.failAllPendingSends();
      this.setState({ status: 'closed' });
      this.reportInitialLoadFailed();
      return;
    }
    this.setState({ status: 'reconnecting' });
    const lifecycle = this.lifecycle;
    this.reconnectTimer = this.timers.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.closedByUs || lifecycle !== this.lifecycle) return;
      void this.openSocket();
    }, delay);
  }

  private denyAccessTerminally(): void {
    this.closedByUs = true;
    this.controller.close();
    this.initialLoad.dispose();
    this.failAllPendingSends();
    this.setState({ status: 'closed', lastErrorCode: TERMINAL_ERROR_CODE.ACCESS_DENIED });
  }

  private onMessage(data: string): void {
    const frame = parseFrame(data);
    if (!frame || !frame.type) {
      this.diag?.(DIAG.FRAME_DROPPED, { kind: 'unparseable', reason: 'bad-envelope' });
      return;
    }
    this.lastInboundAt = this.timers.now();
    const payload = frame.payload ?? {};
    switch (frame.type) {
      case 'message':
        return this.applyMessage((payload as { message: WireMessageRow }).message, 'live');
      case 'ack':
        return this.applyAck(
          payload as { clientMessageId?: string; seq?: number; readSeq?: number },
        );
      case 'history-page':
        return this.applyHistoryPage((payload as { messages: WireMessageRow[] }).messages ?? []);
      case 'presence':
        return this.setState({ presence: (payload as { online: string[] }).online ?? [] });
      case 'typing':
        return this.applyTyping((payload as { uid: string }).uid);
      case 'snapshot':
        return this.applyChannelSnapshot(payload as unknown as WireChannelSnapshot);
      case 'send-rejected':
        return this.applySendRejected(payload);
      case 'error': {
        const code = String((payload as { code?: unknown }).code ?? 'error');
        // An older Worker sends this uncorrelated form, with no clientMessageId to target one send.
        if (code === MEMBERSHIP_PENDING_CODE) {
          const raw = (payload as { retryAfterMs?: unknown }).retryAfterMs;
          const delay = this.clampRetryDelay(typeof raw === 'number' ? raw : undefined);
          this.diag?.(DIAG.ERROR_FRAME, {
            code: MEMBERSHIP_PENDING_CODE,
            correlated: false,
            delayMs: delay,
            pendingSends: this.pendingSends.size,
          });
          for (const pending of this.pendingSends.values()) {
            if (!pending.failed) {
              pending.serverRetryable = true;
              pending.lastRejectionCode = MEMBERSHIP_PENDING_CODE;
            }
          }
          return this.scheduleMembershipPendingRetry(delay);
        }
        this.diag?.(DIAG.ERROR_FRAME, { code: safeDiagnosticLabel(code), correlated: false });
        return this.setState({ lastErrorCode: code });
      }
      case 'revision':
        return this.applyRevisionFrame(
          payload as { messageSeq?: number; kind?: RevisionKind; messageRevision?: number },
        );
      case 'heartbeat-ack':
        return;
      default:
        this.diag?.(DIAG.FRAME_DROPPED, {
          kind: safeDiagnosticLabel(frame.type),
          reason: 'unknown-type',
        });
        return;
    }
  }

  private applyRevisionFrame(payload: {
    messageSeq?: number;
    kind?: RevisionKind;
    messageRevision?: number;
  }): void {
    const seq = payload.messageSeq;
    const kind = payload.kind;
    const messageRevision = payload.messageRevision;
    if (typeof seq !== 'number' || kind == null || typeof messageRevision !== 'number') {
      this.diag?.(DIAG.FRAME_DROPPED, { kind: 'revision', reason: 'malformed-payload' });
      return;
    }
    const prev = this.overlays.get(seq);
    if (prev && prev.messageRevision >= messageRevision) {
      this.diag?.(DIAG.FRAME_DROPPED, {
        kind: 'revision',
        reason: 'stale-revision',
        seq,
        messageRevision,
        heldRevision: prev.messageRevision,
      });
      return;
    }
    this.overlays.set(seq, { kind, messageRevision });
    const messageId = seqToMessageId(seq);
    const original = this.originalRows.get(seq);
    const rendered =
      Boolean(original) && this.state.messages.some((m) => m.messageId === messageId);
    this.diag?.(DIAG.REVISION_APPLIED, {
      seq,
      kind,
      messageRevision,
      rendered,
    });
    if (rendered && original) {
      const overlaid = applyModerationOverlay(original, this.effectiveOverlay(seq, null));
      const next = this.state.messages.map((m) => (m.messageId === messageId ? overlaid : m));
      this.setState({ messages: next });
    }
  }

  private effectiveOverlay(
    seq: number,
    rowOverlay: ModerationOverlay | null,
  ): ModerationOverlay | null {
    const fromFrame = this.overlays.get(seq) ?? null;
    if (!rowOverlay) return fromFrame;
    if (!fromFrame) return rowOverlay;
    return fromFrame.messageRevision >= rowOverlay.messageRevision ? fromFrame : rowOverlay;
  }

  private renderRow(row: WireMessageRow): ChatMessageV1 {
    const mapped = wireRowToMessage(row, this.config.threadId);
    this.originalRows.set(row.seq, mapped);
    return applyModerationOverlay(mapped, this.effectiveOverlay(row.seq, overlayFromRow(row)));
  }

  private applyChannelSnapshot(snap: WireChannelSnapshot): void {
    if (isInboxSnapshot(snap as never)) {
      this.diag?.(DIAG.FRAME_DROPPED, { kind: 'snapshot', reason: 'inbox-snapshot-on-channel' });
      return;
    }
    if (typeof snap.lastMessageSeq !== 'number') {
      this.diag?.(DIAG.FRAME_DROPPED, { kind: 'snapshot', reason: 'missing-last-message-seq' });
      return;
    }

    const resync = snap.resync !== false;
    const cursorBefore = this.resumeSeq;
    const delta = Array.isArray(snap.delta) ? snap.delta : [];

    if (!resync) {
      for (const row of delta) this.applyMessage(row, 'delta');
      if (snap.lastMessageSeq > this.resumeSeq) this.resumeSeq = snap.lastMessageSeq;
      this.diag?.(DIAG.RESUME_RESULT, {
        lastMessageSeq: snap.lastMessageSeq,
        resync: false,
        deltaCount: delta.length,
        cursorBefore,
        cursorAfter: this.resumeSeq,
        readSeq: typeof snap.readSeq === 'number' ? snap.readSeq : null,
      });
      this.setState({
        ...(this.state.hasLoadedInitialData ? {} : this.initialDataLoaded()),
        isSynced: true,
      });
      return;
    }

    this.overlays.clear();
    this.originalRows.clear();
    this.resumeSeq = 0;
    const priorCount = this.state.messages.length;
    const keptOptimistic = this.state.messages.filter((m) => m.meta?.optimistic);
    this.diag?.(DIAG.RESUME_RESULT, {
      lastMessageSeq: snap.lastMessageSeq,
      resync: true,
      deltaCount: delta.length,
      cursorBefore,
      cursorAfter: 0,
      readSeq: typeof snap.readSeq === 'number' ? snap.readSeq : null,
    });
    this.diag?.(DIAG.RESYNC_DROPPED_TAIL, {
      removedCount: priorCount - keptOptimistic.length,
      keptOptimistic: keptOptimistic.length,
    });
    this.setState({ messages: keptOptimistic, hasOlder: true, isFetchingOlder: false });
    this.requestHistory(null, 'resync');
  }

  private applyMessage(row: WireMessageRow, source: 'live' | 'delta'): void {
    if (!row || typeof row.seq !== 'number') {
      this.diag?.(DIAG.FRAME_DROPPED, { kind: 'message', source, reason: 'missing-seq' });
      return;
    }
    const prior = this.diag ? this.priorRowFacts(row) : null;
    const cursorBefore = this.resumeSeq;
    const mapped = this.renderRow(row);
    this.mergeMessage(mapped, row);
    if (row.seq > this.resumeSeq) this.resumeSeq = row.seq;
    if (!this.diag || !prior) return;

    const notable = row.moderationKind != null || prior.reconciledOptimistic;
    if (source === 'delta' && !notable) return;
    this.diag(DIAG.FRAME_APPLIED, {
      kind: 'message',
      source,
      seq: row.seq,
      hasClientMessageId: Boolean(row.clientMessageId),
      moderationKind: row.moderationKind ?? null,
      op: prior.reconciledOptimistic
        ? 'optimistic-reconcile'
        : prior.hadRow
          ? 'replace-by-seq'
          : 'insert',
      cursorBefore,
      cursorAfter: this.resumeSeq,
    });
  }

  private priorRowFacts(row: WireMessageRow): {
    hadRow: boolean;
    reconciledOptimistic: boolean;
  } {
    const messageId = seqToMessageId(row.seq);
    const existing = this.state.messages.find((m) => m.messageId === messageId);
    return {
      hadRow: existing != null,
      reconciledOptimistic: Boolean(
        row.clientMessageId &&
        this.state.messages.some(
          (m) => m.meta?.optimistic && m.meta?.clientMessageId === row.clientMessageId,
        ),
      ),
    };
  }

  private mergeMessage(mapped: ChatMessageV1, row: WireMessageRow): void {
    if (row.clientMessageId) this.clearPendingSend(row.clientMessageId);
    const next = this.state.messages.filter(
      (m) =>
        m.messageId !== mapped.messageId &&
        (m.meta?.clientMessageId !== row.clientMessageId || !m.meta?.optimistic),
    );
    next.push(mapped);
    next.sort(sortBySeq);
    this.setState({ messages: next });
  }

  private applyAck(payload: { clientMessageId?: string; seq?: number; readSeq?: number }): void {
    if (payload.clientMessageId == null || typeof payload.seq !== 'number') return;
    const seq = payload.seq;
    const cmid = payload.clientMessageId;
    this.diag?.(DIAG.SEND_ACK, {
      clientMessageId: cmid,
      seq,
      cursorBefore: this.resumeSeq,
      cursorAfter: seq > this.resumeSeq ? seq : this.resumeSeq,
      wasPending: this.pendingSends.has(cmid),
    });
    this.clearPendingSend(cmid);
    const next = this.state.messages.map((m) => {
      if (!m.meta?.optimistic || m.meta?.clientMessageId !== cmid) return m;
      const {
        sendFailed: _sendFailed,
        sendFailureCode: _sendFailureCode,
        sendRetryable: _sendRetryable,
        ...restMeta
      } = m.meta;
      return {
        ...m,
        messageId: seqToMessageId(seq),
        meta: { ...restMeta, optimistic: false, seq },
      };
    });
    next.sort(sortBySeq);
    if (seq > this.resumeSeq) this.resumeSeq = seq;
    this.setState({ messages: next });
  }

  private applyHistoryPage(rows: WireMessageRow[]): void {
    const cursorBefore = this.resumeSeq;
    const answersResync = this.historyRequests.shift() === 'resync';
    const mapped = rows.map((r) => this.renderRow(r));
    const incomingCmids = new Set<string>();
    for (const r of rows) {
      if (r.clientMessageId) {
        incomingCmids.add(r.clientMessageId);
        this.clearPendingSend(r.clientMessageId);
      }
    }
    const bySeq = new Map<string, ChatMessageV1>();
    for (const m of this.state.messages) {
      if (
        m.meta?.optimistic &&
        typeof m.meta?.clientMessageId === 'string' &&
        incomingCmids.has(m.meta.clientMessageId)
      ) {
        continue;
      }
      bySeq.set(m.messageId, m);
    }
    for (const m of mapped) bySeq.set(m.messageId, m);
    const merged = [...bySeq.values()].sort(sortBySeq);
    for (const r of rows) if (r.seq > this.resumeSeq) this.resumeSeq = r.seq;
    this.setState({
      messages: merged,
      isFetchingOlder: false,
      hasOlder: rows.length >= HISTORY_PAGE_MAX,
      ...(this.state.hasLoadedInitialData ? {} : this.initialDataLoaded()),
      ...(answersResync ? { isSynced: true } : {}),
    });
    if (!this.diag) return;
    const seqs = rows.map((r) => r.seq).filter((s): s is number => typeof s === 'number');
    this.diag(DIAG.HISTORY_PAGE, {
      count: rows.length,
      minSeq: seqs.length > 0 ? Math.min(...seqs) : null,
      maxSeq: seqs.length > 0 ? Math.max(...seqs) : null,
      cursorBefore,
      cursorAfter: this.resumeSeq,
      reconciledOptimistic: incomingCmids.size,
      hasOlder: rows.length >= HISTORY_PAGE_MAX,
      total: merged.length,
    });
  }

  private applyTyping(uid: string): void {
    if (!uid || uid === this.config.currentUserId) return;
    if (!this.state.typing.includes(uid)) this.setState({ typing: [...this.state.typing, uid] });
    const prev = this.typingTimers.get(uid);
    if (prev) this.timers.clearTimeout(prev);
    this.typingTimers.set(
      uid,
      this.timers.setTimeout(() => {
        this.typingTimers.delete(uid);
        this.setState({ typing: this.state.typing.filter((u) => u !== uid) });
      }, TYPING_COALESCE_MS * 2),
    );
  }

  private sendFrame<K extends ClientFrameKind>(type: K, payload: ChannelFramePayload<K>): boolean {
    if (!this.socket || !this.socket.isOpen) return false;
    this.socket.send(buildFrame(type, payload));
    return true;
  }

  send(args: { clientMessageId: string; text: string }): boolean {
    const sent = this.sendFrame(CLIENT_KINDS.SEND, {
      clientMessageId: args.clientMessageId,
      text: args.text,
    });
    if (!sent) {
      this.diag?.(DIAG.SEND_FAILED, {
        clientMessageId: args.clientMessageId,
        code: 'send-failed',
        retryable: null,
        attempts: 0,
        reason: 'socket-not-open',
      });
      this.setState({ lastErrorCode: 'send-failed' });
      return false;
    }
    const now = this.timers.now();
    this.pendingSends.set(args.clientMessageId, {
      clientMessageId: args.clientMessageId,
      text: args.text,
      sentAt: now,
      attempts: 1,
      failed: false,
      serverRetryable: false,
      retryTimer: null,
    });
    const echo = optimisticMessage({
      clientMessageId: args.clientMessageId,
      threadId: this.config.threadId,
      senderId: this.config.currentUserId,
      text: args.text,
      createdAt: now,
    });
    const next = [...this.state.messages, echo].sort(sortBySeq);
    this.setState({ messages: next, lastErrorCode: null });
    this.diag?.(DIAG.SEND_OPTIMISTIC, {
      clientMessageId: args.clientMessageId,
      pendingSends: this.pendingSends.size,
    });
    return true;
  }

  readAck(readSeq: number, focused: boolean): boolean {
    this.lastReadAck = { readSeq, focused };
    return this.sendFrame(CLIENT_KINDS.READ_ACK, { readSeq, focused });
  }

  typing(): void {
    const now = this.timers.now();
    if (now - this.lastTypingSentAt < TYPING_COALESCE_MS) return;
    this.lastTypingSentAt = now;
    this.sendFrame(CLIENT_KINDS.TYPING, {});
  }

  presenceSubscribe(): void {
    this.presenceSubscribed = true;
    this.sendFrame(CLIENT_KINDS.PRESENCE_SUBSCRIBE, {});
  }

  presenceUnsubscribe(): void {
    this.presenceSubscribed = false;
    this.sendFrame(CLIENT_KINDS.PRESENCE_UNSUBSCRIBE, {});
    this.setState({ presence: [] });
  }

  fetchOlder(): void {
    if (this.state.isFetchingOlder || !this.state.hasOlder) return;
    const oldest = this.state.messages.find((m) => typeof m.meta?.seq === 'number');
    const beforeSeq =
      oldest && typeof oldest.meta?.seq === 'number' ? (oldest.meta.seq as number) : null;
    this.setState({ isFetchingOlder: true });
    if (!this.requestHistory(beforeSeq, 'older')) this.setState({ isFetchingOlder: false });
  }

  private requestHistory(beforeSeq: number | null, kind: HistoryRequestKind): boolean {
    const sent = this.sendFrame(CLIENT_KINDS.HISTORY, { beforeSeq, limit: HISTORY_PAGE_MAX });
    if (sent) this.historyRequests.push(kind);
    this.diag?.(DIAG.HISTORY_REQUEST, { beforeSeq, limit: HISTORY_PAGE_MAX, sent });
    return sent;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const tick = () => {
      if (!this.socket || !this.socket.isOpen) return;
      if (this.isInboundSilent()) return this.closeDeadSocket();
      this.sendFrame(CLIENT_KINDS.HEARTBEAT, {});
      this.heartbeatTimer = this.timers.setTimeout(tick, HEARTBEAT_MS);
    };
    this.heartbeatTimer = this.timers.setTimeout(tick, HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer != null) {
      this.timers.clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private isInboundSilent(): boolean {
    if (this.lastInboundAt == null) return false;
    return this.timers.now() - this.lastInboundAt >= INBOUND_SILENCE_LIMIT_MS;
  }

  private closeDeadSocket(): void {
    const socket = this.socket;
    this.diag?.(DIAG.SOCKET_LIVENESS_TIMEOUT, {
      silentMs: this.lastInboundAt == null ? null : this.timers.now() - this.lastInboundAt,
      thresholdMs: INBOUND_SILENCE_LIMIT_MS,
      attempt: this.connectAttempt,
      resumeSeq: this.resumeSeq,
      pendingSends: this.pendingSends.size,
    });
    this.lastInboundAt = null;
    socket?.close(WATCHDOG_CLOSE_CODE, 'client liveness timeout');
  }

  close(): void {
    this.closedByUs = true;
    this.lifecycle += 1;
    this.controller.close();
    this.initialLoad.dispose();
    this.stopHeartbeat();
    this.lastInboundAt = null;
    for (const t of this.typingTimers.values()) this.timers.clearTimeout(t);
    this.typingTimers.clear();
    this.overlays.clear();
    this.originalRows.clear();
    for (const pending of this.pendingSends.values()) this.clearSendRetryTimer(pending);
    this.pendingSends.clear();
    if (this.reconnectTimer != null) {
      this.timers.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.membershipRetryTimer != null) {
      this.timers.clearTimeout(this.membershipRetryTimer);
      this.membershipRetryTimer = null;
    }
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      socket.close(1000, 'client teardown');
    }
    this.setState({ status: 'closed', typing: [], presence: [], isFetchingOlder: false });
  }
}

function sortBySeq(a: ChatMessageV1, b: ChatMessageV1): number {
  const sa = typeof a.meta?.seq === 'number' ? (a.meta.seq as number) : Number.POSITIVE_INFINITY;
  const sb = typeof b.meta?.seq === 'number' ? (b.meta.seq as number) : Number.POSITIVE_INFINITY;
  if (sa !== sb) return sa - sb;
  return a.createdAt - b.createdAt;
}
