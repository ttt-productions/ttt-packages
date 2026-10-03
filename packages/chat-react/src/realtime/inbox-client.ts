// The Inbox realtime client: a SEPARATE WebSocket (scope `inbox`) to the user's
// inbox DO. It maintains the channel/invite registry + unread projection that
// drives the inbox view — DOTS ONLY, no counts (Contract C / "Unread + inbox").
//
// The inbox DO pushes a full `snapshot` ({ registry, hasUnread }) on connect, on
// `resume`, and on every live delta (a projection apply). This client just
// mirrors the latest snapshot into an observable store + a per-channel unread set.
// Same connection lifecycle as the channel client (subprotocol auth, reconnect,
// 4401 re-grant once, 4403 stop, auth-switch teardown).

import { createReconnectController, type ReconnectController } from '@ttt-productions/realtime-core';
import {
  ChatMarkReadResultPayloadSchema,
  SERVER_KINDS,
  type ChatMarkReadFailureCode,
} from '@ttt-productions/chat-schemas';
import {
  CLIENT_FRAME,
  CHAT_CLOSE_CODES,
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
  /** Active (non-tombstoned) channel/invite registry entries — inbox-view visibility. */
  registry: WireRegistryEntry[];
  /** True if ANY active channel/invite has unread (drives the dock dot). */
  hasUnread: boolean;
  /** The set of channelRefs that currently carry an unread dot (per-row dots). */
  unreadChannelRefs: string[];
  /**
   * The last TERMINAL error code (mirrors `ChannelClientState.lastErrorCode`):
   * `'access-denied'` when the inbox grant provider throws `ChatAccessDeniedError`
   * (a genuine, terminal policy "no" — e.g. a banned/suspended account), and
   * `'revoked'` on a 4403 REVOKED close. Null while healthy and across transient
   * reconnects. The app subscribes to inbox state directly (there is no inbox React
   * hook in this package), so this stable code is the surface — it invents no new UI.
   */
  lastErrorCode: string | null;
  /**
   * True once the first authoritative snapshot has been applied — the registry and dots
   * are then the inbox runtime's answer, so an empty registry means "nothing here"
   * rather than "not loaded yet". Once true it stays true.
   */
  hasLoadedInitialData: boolean;
  /**
   * True once the first open has failed for long enough to say so — the same rule as
   * `ChannelClientState.initialLoadFailed`. Cleared by the first snapshot or `retryNow()`.
   */
  initialLoadFailed: boolean;
}

/**
 * How one `markRead` ended: `ok` — the inbox runtime advanced the read cursor (its
 * fresh snapshot clears the dot); otherwise `code` says why not — the runtime's own
 * reason, `not-sent` (no open socket, nothing was sent), or `connection-lost` (the
 * socket closed before the answer arrived, so the outcome is unknown and the dot stays).
 */
export type ChatMarkReadOutcome =
  | { ok: true }
  | { ok: false; code: ChatMarkReadFailureCode | 'not-sent' | 'connection-lost' };

export interface InboxClientConfig {
  endpoint: string;
  /** The authenticated uid (the inbox owner; the DO serves no one else's data). */
  currentUserId: string;
  /** Mints/refreshes an INBOX-scope grant (scope `{ kind:'inbox', uid }`). */
  grantProvider: GrantProvider;
  socketFactory: SocketFactory;
  timers?: TransportTimers;
  reconnect?: { baseDelayMs?: number; maxDelayMs?: number; maxAttempts?: number | null; random?: () => number };
  /**
   * OPT-IN structured client diagnostics — the SAME option type and emitter the
   * channel client uses (one owner, `./diagnostics.ts`). Default OFF: absent or
   * `false` changes nothing and costs one nullish check. `true` emits one
   * single-line `console.debug` entry per decision under the stable
   * `chat_client_inbox_*` names; a function routes them to the app's logger.
   * Inbox payloads are SIZES ONLY — registry/unread counts and deltas, never a
   * `channelRef` (which names one specific conversation).
   */
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
  /**
   * The current lifecycle's number, advanced by every `connect()` and `close()`; a grant,
   * timer, or socket callback of an older lifecycle is ignored (FRONTEND-108).
   */
  private lifecycle = 0;
  private readonly initialLoad: InitialLoadBudget;
  /** Mark-reads sent on the current socket, awaiting their correlated result, by requestId. */
  private readonly pendingMarkReads = new Map<string, (outcome: ChatMarkReadOutcome) => void>();
  /** Structured diagnostics emitter, or null when off (the default, zero-overhead). */
  private readonly diag: ChatClientDiagnosticsEmitter;
  /** Monotonic socket-open attempt counter (diagnostics correlation only). */
  private connectAttempt = 0;
  /** Why the CURRENT connect attempt is happening (diagnostics only). */
  private reconnectCause: 'initial' | 'auth-expired' | 'transient-close' | 'grant-error' | 'manual-retry' = 'initial';
  /** The last close code observed, carried into the next attempt's cause line. */
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

  /**
   * Retry now (the first-open failure's Retry) — the same rule as `ChannelClient.retryNow`:
   * a reconnect waiting out its backoff opens at once; a stopped lifecycle starts again; an
   * attempt in flight is left to finish; the first-open failure clears either way.
   */
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
    // Idempotency guard (mirrors ChannelClient): connect() only starts a lifecycle
    // from a fresh (idle) or fully torn-down (closed) state. A second connect()
    // while one is already connecting / open / reconnecting is a no-op, so a
    // double-mounted dock cannot open a SECOND inbox socket against the per-uid
    // cap. The reconnect path uses openSocket() / scheduleReconnect() directly
    // (never connect()), so this never blocks a legitimate reconnect.
    if (this.state.status !== 'idle' && this.state.status !== 'closed') return;
    // REVIVE the controller. `controller.close()` is PERMANENT: while it is in
    // state `closed`, `start()` and `onOpen()` no-op and every later `onClose()`
    // returns null — so without this reset a close() → connect() client opens a
    // socket and works normally until its FIRST transient close, then parks
    // terminally in `closed` with reconnect disabled and no surfaced error code.
    this.controller.reset();
    // A terminal verdict (4403 REVOKED / ChatAccessDeniedError) is terminal WITHIN
    // its lifecycle; an explicit connect() is a fresh attempt the authority may
    // legitimately re-deny, so the previous lifecycle's code must not persist.
    // The registry/unread projection is deliberately KEPT — the DO's next snapshot
    // is authoritative, and blanking the dock on every restart is pure UI churn.
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
      // A TERMINAL access denial (the app translated an authoritative policy "no"
      // — e.g. Firebase `permission-denied` for a banned/suspended account — into the
      // package-owned ChatAccessDeniedError) must NOT reconnect: the next mint would
      // just re-deny, reconnect-looping forever and warning every cycle. Every other
      // mint failure (network/transient) stays retryable and backs off as before.
      const terminal = isChatAccessDeniedError(err);
      this.diag?.(DIAG.INBOX_GRANT_FAILED, { attempt: this.connectAttempt, terminal });
      if (terminal) return this.denyAccessTerminally();
      this.reconnectCause = 'grant-error';
      if (!this.state.hasLoadedInitialData) this.initialLoad.noteFailedAttempt();
      return this.scheduleReconnect();
    }
    // A grant minted for an earlier lifecycle must never open a socket in this one.
    if (lifecycle !== this.lifecycle || this.closedByUs) return;
    const url = `${this.config.endpoint.replace(/\/$/, '')}/inbox`;
    // Every callback is fenced to THIS socket: once it has been replaced or torn down, its
    // late open, frames, and close are ignored.
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
    // The DO sends a snapshot on accept; a `resume` re-requests it after a reconnect gap.
    const sent = this.sendFrame(CLIENT_FRAME.RESUME, {});
    // The inbox resume is CURSORLESS by contract (the DO always answers with a full
    // authoritative snapshot) — there is no `afterSeq` half to record here.
    this.diag?.(DIAG.INBOX_RESUME_REQUEST, { attempt: this.connectAttempt, cursorless: true, sent });
  }

  private onClose(code: number, _reason: string): void {
    this.socket = null;
    this.lastCloseCode = code;
    // A mark-read sent on this socket can no longer be answered.
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

  /**
   * Terminal access denial surfaced by the inbox grant provider
   * (`ChatAccessDeniedError`). Same terminal posture as the 4403 REVOKED close: mark
   * closed-by-us, close the reconnect controller, and surface the stable
   * `access-denied` code. The inbox client tracks NO optimistic/pending sends
   * (mark-read is fire-and-forget with no local pending state), so — unlike
   * ChannelClient — there is nothing to fail here; only the lifecycle stops.
   */
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
    if (frame.type === SERVER_KINDS.MARK_READ_RESULT) return this.applyMarkReadResult(frame.payload);
    // The inbox DO pushes a full `snapshot`; a future lightweight `unread` push
    // carries either a full snapshot or a `{ hasUnread }` dock-dot patch. Route both
    // instead of silently dropping the `unread` type (C-M2).
    if (frame.type !== 'snapshot' && frame.type !== 'unread') {
      this.diag?.(DIAG.INBOX_FRAME_DROPPED, { kind: safeDiagnosticLabel(frame.type), reason: 'unknown-type' });
      return;
    }
    const payload = frame.payload as unknown as WireInboxSnapshot | { hasUnread: boolean };
    if (isInboxSnapshot(payload as WireInboxSnapshot)) {
      this.applySnapshot(payload as WireInboxSnapshot, frame.type);
    } else if (frame.type === 'unread' && typeof (payload as { hasUnread?: unknown }).hasUnread === 'boolean') {
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
      // A stray CHANNEL snapshot ({ lastMessageSeq, readSeq }) on the inbox socket —
      // deliberately inert, but never silently invisible under diagnostics.
      this.diag?.(DIAG.INBOX_FRAME_DROPPED, {
        kind: safeDiagnosticLabel(frame.type),
        reason: 'not-an-inbox-payload',
      });
    }
  }

  private applySnapshot(snap: WireInboxSnapshot, source: string): void {
    // Keep every non-tombstoned entry — including ARCHIVED rows — so the inbox view can
    // render both the active list and the Archived toggle. `archived` is a distinct
    // dimension from `tombstoned`; archived rows are still `state: 'active'`.
    const registry = snap.registry.filter((e) => e.state === 'active');
    // The DO's `hasUnread` is the authoritative dock dot. Per-row dots are derived from
    // the same projection but exclude ARCHIVED rows (archive = done — an archived row
    // never shows a dot). The DO clears unread on archive, so this is belt-and-braces.
    const unreadChannelRefs = deriveUnreadRefs(snap);
    const hasUnread = Boolean(snap.hasUnread);
    const before = this.state;
    if (!before.hasLoadedInitialData) this.initialLoad.loaded();
    this.setState({ registry, hasUnread, unreadChannelRefs, hasLoadedInitialData: true, initialLoadFailed: false });
    if (!this.diag) return;
    // SIZES ONLY — a channelRef names one specific conversation and never enters a
    // diagnostic line.
    this.diag(DIAG.INBOX_SNAPSHOT_APPLIED, {
      source: safeDiagnosticLabel(source),
      received: snap.registry.length,
      // `received - active` is the tombstoned count the client filtered out.
      active: registry.length,
      archived: registry.filter((e) => e.archived === true).length,
      hasUnread,
      unreadCount: unreadChannelRefs.length,
      registryDelta: registry.length - before.registry.length,
    });
    const unreadChanged =
      before.hasUnread !== hasUnread || before.unreadChannelRefs.length !== unreadChannelRefs.length;
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

  /** True if a specific channel/invite currently carries an unread dot. */
  channelHasUnread(channelRef: string): boolean {
    return this.state.unreadChannelRefs.includes(channelRef);
  }

  /**
   * Clear a channel/invite's unread WITHOUT opening it (the inbox-view mark-read
   * controls). Sends `mark-read` with a fresh `requestId`; the inbox runtime advances the
   * member's read cursor, pushes a fresh authoritative snapshot (which is what removes
   * the dot — there is NO optimistic local clear), and answers with a
   * `mark-read-result` naming the same request. The promise settles on that answer —
   * never on a timer — or with `not-sent` when no socket is open, or `connection-lost`
   * when the socket closes first.
   */
  markRead(channelRef: string): Promise<ChatMarkReadOutcome> {
    const requestId = newCorrelationId();
    const sent = this.sendFrame(CLIENT_FRAME.MARK_READ, { channelRef, requestId });
    // The ref itself is never logged — only that a mark-read was written and what the
    // unread projection looked like at that moment (the DO's snapshot is what clears it).
    this.diag?.(DIAG.INBOX_MARK_READ, { sent, unreadCount: this.state.unreadChannelRefs.length });
    if (!sent) return Promise.resolve({ ok: false, code: 'not-sent' });
    return new Promise((resolve) => this.pendingMarkReads.set(requestId, resolve));
  }

  /** Settle the mark-read the result names; a result naming no pending request is ignored. */
  private applyMarkReadResult(payload: Record<string, unknown> | undefined): void {
    const parsed = ChatMarkReadResultPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      this.diag?.(DIAG.INBOX_FRAME_DROPPED, { kind: SERVER_KINDS.MARK_READ_RESULT, reason: 'malformed-payload' });
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

  /** Permanently close (auth-user switch / unmount). Idempotent. */
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
      // Detach first: the socket's own late close is not this lifecycle's event.
      const socket = this.socket;
      this.socket = null;
      socket.close(1000, 'client teardown');
    }
    this.settlePendingMarkReads({ ok: false, code: 'connection-lost' });
    this.setState({ status: 'closed' });
  }
}

/**
 * Derive the per-channel unread set from a snapshot. The inbox DO's snapshot
 * carries a per-entry `unread` boolean on every active registry entry alongside
 * the global `hasUnread` roll-up that drives the dock dot. An entry without the
 * field (a legacy/pre-per-entry row) simply carries no per-row dot — the dock dot
 * still lights off `hasUnread`.
 *
 * ARCHIVED rows are excluded from the unread roll-up (archive = done — the DO clears
 * unread on archive; the client also never counts them).
 */
function deriveUnreadRefs(snap: WireInboxSnapshot): string[] {
  const refs: string[] = [];
  for (const e of snap.registry) {
    if (e.state !== 'active') continue;
    if (e.archived === true) continue;
    if (e.unread === true) refs.push(e.channelRef);
  }
  return refs;
}
