import {
  createReconnectController,
  type ReconnectController,
} from '@ttt-productions/realtime-core';
import {
  ChatMarkReadResultPayloadSchema,
  SERVER_KINDS,
  type ChatMarkReadFailureCode,
  CLIENT_KINDS,
  CHAT_CLOSE_CODES,
} from '@ttt-productions/chat-schemas';
import {
  buildFrame,
  parseFrame,
  isInboxSnapshot,
  type WireInboxSnapshot,
  type WireRegistryEntry,
} from './wire.js';
import type { RealtimeSocket, SocketFactory } from './socket.js';
import type { GrantProvider, TransportTimers, RealtimeStatus } from './shared.js';
import {
  defaultTimers,
  isChatAccessDeniedError,
  isTerminalErrorCode,
  newCorrelationId,
  TERMINAL_ERROR_CODE,
} from './shared.js';
import { InitialLoadBudget } from './initial-load-budget.js';
import {
  createDiagnosticsEmitter,
  safeDiagnosticLabel,
  CHAT_CLIENT_DIAGNOSTIC_EVENTS as DIAG,
  type ChatClientDiagnosticsEmitter,
  type ChatClientDiagnosticsOption,
} from './diagnostics.js';

export interface InboxClientState {
  status: RealtimeStatus;
  registry: WireRegistryEntry[];
  hasUnread: boolean;
  unreadChannelRefs: string[];
  lastErrorCode: string | null;
  hasLoadedInitialData: boolean;
  initialLoadFailed: boolean;
}

export type ChatMarkReadOutcome =
  { ok: true } | { ok: false; code: ChatMarkReadFailureCode | 'not-sent' | 'connection-lost' };

export interface InboxClientConfig {
  endpoint: string;
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

const INITIAL: InboxClientState = {
  status: 'idle',
  registry: [],
  hasUnread: false,
  unreadChannelRefs: [],
  lastErrorCode: null,
  hasLoadedInitialData: false,
  initialLoadFailed: false,
};

export class InboxClient {
  private readonly timers: TransportTimers;
  private readonly controller: ReconnectController;
  private socket: RealtimeSocket | null = null;
  private state: InboxClientState = INITIAL;
  private readonly listeners = new Set<(s: InboxClientState) => void>();
  private reauthAttempted = false;
  private reconnectTimer: ReturnType<TransportTimers['setTimeout']> | null = null;
  private closedByUs = false;
  private lifecycle = 0;
  private readonly initialLoad: InitialLoadBudget;
  private readonly pendingMarkReads = new Map<string, (outcome: ChatMarkReadOutcome) => void>();
  private readonly diag: ChatClientDiagnosticsEmitter;
  private connectAttempt = 0;
  private reconnectCause:
    'initial' | 'auth-expired' | 'transient-close' | 'grant-error' | 'manual-retry' = 'initial';
  private lastCloseCode: number | null = null;

  constructor(private readonly config: InboxClientConfig) {
    this.timers = config.timers ?? defaultTimers;
    this.controller = createReconnectController(config.reconnect ?? {});
    this.diag = createDiagnosticsEmitter(config.diagnostics);
    this.initialLoad = new InitialLoadBudget(this.timers, () => this.reportInitialLoadFailed());
  }

  getState(): InboxClientState {
    return this.state;
  }

  subscribe(fn: (s: InboxClientState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setState(patch: Partial<InboxClientState>): void {
    this.state = { ...this.state, ...patch };
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

  private async openSocket(): Promise<void> {
    const lifecycle = this.lifecycle;
    this.connectAttempt += 1;
    this.diag?.(DIAG.INBOX_CONNECT_ATTEMPT, {
      attempt: this.connectAttempt,
      cause: this.reconnectCause,
      closeCode: this.lastCloseCode,
      registryCount: this.state.registry.length,
    });
    let grantToken: string;
    try {
      grantToken = await this.config.grantProvider();
    } catch (err) {
      if (lifecycle !== this.lifecycle) return;
      const terminal = isChatAccessDeniedError(err);
      this.diag?.(DIAG.INBOX_GRANT_FAILED, { attempt: this.connectAttempt, terminal });
      if (terminal) return this.denyAccessTerminally();
      this.reconnectCause = 'grant-error';
      if (!this.state.hasLoadedInitialData) this.initialLoad.noteFailedAttempt();
      return this.scheduleReconnect();
    }
    if (lifecycle !== this.lifecycle || this.closedByUs) return;
    const url = `${this.config.endpoint.replace(/\/$/, '')}/inbox`;
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
        onError: () => undefined,
      },
    });
    this.socket = socket;
  }

  private onOpen(): void {
    this.controller.onOpen();
    this.reauthAttempted = false;
    this.setState({ status: 'open' });
    this.diag?.(DIAG.INBOX_SOCKET_OPEN, {
      attempt: this.connectAttempt,
      cause: this.reconnectCause,
      registryCount: this.state.registry.length,
      hasUnread: this.state.hasUnread,
    });
    const sent = this.sendFrame(CLIENT_KINDS.RESUME, {});
    this.diag?.(DIAG.INBOX_RESUME_REQUEST, {
      attempt: this.connectAttempt,
      cursorless: true,
      sent,
    });
  }

  private onClose(code: number, _reason: string): void {
    this.socket = null;
    this.lastCloseCode = code;
    this.settlePendingMarkReads({ ok: false, code: 'connection-lost' });
    if (this.closedByUs) {
      this.diag?.(DIAG.INBOX_SOCKET_CLOSE, { code, closedByUs: true, outcome: 'closed' });
      this.setState({ status: 'closed' });
      return;
    }
    if (code === CHAT_CLOSE_CODES.AUTH_EXPIRED && !this.reauthAttempted) {
      this.reauthAttempted = true;
      this.reconnectCause = 'auth-expired';
      this.diag?.(DIAG.INBOX_SOCKET_CLOSE, { code, closedByUs: false, outcome: 're-grant' });
      this.setState({ status: 'reconnecting' });
      void this.openSocket();
      return;
    }
    if (code === CHAT_CLOSE_CODES.REVOKED) {
      this.closedByUs = true;
      this.controller.close();
      this.diag?.(DIAG.INBOX_SOCKET_CLOSE, { code, closedByUs: false, outcome: 'revoked' });
      this.setState({ status: 'closed', lastErrorCode: TERMINAL_ERROR_CODE.REVOKED });
      this.reportInitialLoadFailed();
      return;
    }
    this.reconnectCause = 'transient-close';
    if (!this.state.hasLoadedInitialData) this.initialLoad.noteFailedAttempt();
    this.diag?.(DIAG.INBOX_SOCKET_CLOSE, { code, closedByUs: false, outcome: 'reconnect' });
    this.scheduleReconnect();
  }

  private denyAccessTerminally(): void {
    this.closedByUs = true;
    this.controller.close();
    this.initialLoad.dispose();
    this.setState({ status: 'closed', lastErrorCode: TERMINAL_ERROR_CODE.ACCESS_DENIED });
  }

  private scheduleReconnect(): void {
    const delay = this.controller.onClose();
    this.diag?.(DIAG.INBOX_RECONNECT_SCHEDULED, {
      delayMs: delay,
      cause: this.reconnectCause,
      attempt: this.connectAttempt,
    });
    if (delay == null) {
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

  private onMessage(data: string): void {
    const frame = parseFrame(data);
    if (!frame || !frame.payload) {
      this.diag?.(DIAG.INBOX_FRAME_DROPPED, { kind: 'unparseable', reason: 'bad-envelope' });
      return;
    }
    if (frame.type === SERVER_KINDS.MARK_READ_RESULT)
      return this.applyMarkReadResult(frame.payload);
    if (frame.type !== 'snapshot' && frame.type !== 'unread') {
      this.diag?.(DIAG.INBOX_FRAME_DROPPED, {
        kind: safeDiagnosticLabel(frame.type),
        reason: 'unknown-type',
      });
      return;
    }
    const payload = frame.payload as WireInboxSnapshot | { hasUnread: boolean };
    if (isInboxSnapshot(payload as WireInboxSnapshot)) {
      this.applySnapshot(payload as WireInboxSnapshot, frame.type);
    } else if (
      frame.type === 'unread' &&
      typeof (payload as { hasUnread?: unknown }).hasUnread === 'boolean'
    ) {
      const hasUnread = Boolean((payload as { hasUnread: boolean }).hasUnread);
      const before = this.state.hasUnread;
      this.setState({ hasUnread });
      if (before !== hasUnread) {
        this.diag?.(DIAG.INBOX_UNREAD_UPDATED, {
          source: 'unread-patch',
          hasUnreadBefore: before,
          hasUnreadAfter: hasUnread,
          unreadCountBefore: this.state.unreadChannelRefs.length,
          unreadCountAfter: this.state.unreadChannelRefs.length,
          unreadCountDelta: 0,
        });
      }
    } else {
      this.diag?.(DIAG.INBOX_FRAME_DROPPED, {
        kind: safeDiagnosticLabel(frame.type),
        reason: 'not-an-inbox-payload',
      });
    }
  }

  private applySnapshot(snap: WireInboxSnapshot, source: string): void {
    const registry = snap.registry.filter((e) => e.state === 'active');
    const unreadChannelRefs = deriveUnreadRefs(snap);
    const hasUnread = Boolean(snap.hasUnread);
    const before = this.state;
    if (!before.hasLoadedInitialData) this.initialLoad.loaded();
    this.setState({
      registry,
      hasUnread,
      unreadChannelRefs,
      hasLoadedInitialData: true,
      initialLoadFailed: false,
    });
    if (!this.diag) return;
    this.diag(DIAG.INBOX_SNAPSHOT_APPLIED, {
      source: safeDiagnosticLabel(source),
      received: snap.registry.length,
      active: registry.length,
      archived: registry.filter((e) => e.archived === true).length,
      hasUnread,
      unreadCount: unreadChannelRefs.length,
      registryDelta: registry.length - before.registry.length,
    });
    const unreadChanged =
      before.hasUnread !== hasUnread ||
      before.unreadChannelRefs.length !== unreadChannelRefs.length;
    if (unreadChanged) {
      this.diag(DIAG.INBOX_UNREAD_UPDATED, {
        source: safeDiagnosticLabel(source),
        hasUnreadBefore: before.hasUnread,
        hasUnreadAfter: hasUnread,
        unreadCountBefore: before.unreadChannelRefs.length,
        unreadCountAfter: unreadChannelRefs.length,
        unreadCountDelta: unreadChannelRefs.length - before.unreadChannelRefs.length,
      });
    }
  }

  private sendFrame(type: string, payload: Record<string, unknown>): boolean {
    if (!this.socket || !this.socket.isOpen) return false;
    this.socket.send(buildFrame(type, payload));
    return true;
  }

  channelHasUnread(channelRef: string): boolean {
    return this.state.unreadChannelRefs.includes(channelRef);
  }

  markRead(channelRef: string): Promise<ChatMarkReadOutcome> {
    const requestId = newCorrelationId();
    const sent = this.sendFrame(CLIENT_KINDS.MARK_READ, { channelRef, requestId });
    this.diag?.(DIAG.INBOX_MARK_READ, { sent, unreadCount: this.state.unreadChannelRefs.length });
    if (!sent) return Promise.resolve({ ok: false, code: 'not-sent' });
    return new Promise((resolve) => this.pendingMarkReads.set(requestId, resolve));
  }

  private applyMarkReadResult(payload: Record<string, unknown> | undefined): void {
    const parsed = ChatMarkReadResultPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      this.diag?.(DIAG.INBOX_FRAME_DROPPED, {
        kind: SERVER_KINDS.MARK_READ_RESULT,
        reason: 'malformed-payload',
      });
      return;
    }
    const resolve = this.pendingMarkReads.get(parsed.data.requestId);
    if (!resolve) return;
    this.pendingMarkReads.delete(parsed.data.requestId);
    resolve(parsed.data.ok ? { ok: true } : { ok: false, code: parsed.data.code });
  }

  private settlePendingMarkReads(outcome: ChatMarkReadOutcome): void {
    const pending = [...this.pendingMarkReads.values()];
    this.pendingMarkReads.clear();
    for (const resolve of pending) resolve(outcome);
  }

  close(): void {
    this.closedByUs = true;
    this.lifecycle += 1;
    this.controller.close();
    this.initialLoad.dispose();
    if (this.reconnectTimer != null) {
      this.timers.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      socket.close(1000, 'client teardown');
    }
    this.settlePendingMarkReads({ ok: false, code: 'connection-lost' });
    this.setState({ status: 'closed' });
  }
}

function deriveUnreadRefs(snap: WireInboxSnapshot): string[] {
  const refs: string[] = [];
  for (const e of snap.registry) {
    if (e.state !== 'active') continue;
    if (e.archived === true) continue;
    if (e.unread === true) refs.push(e.channelRef);
  }
  return refs;
}
