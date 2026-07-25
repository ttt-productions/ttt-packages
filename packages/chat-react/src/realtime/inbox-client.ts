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
import { defaultTimers, isChatAccessDeniedError } from './shared.js';
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
}

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

const INITIAL: InboxClientState = { status: 'idle', registry: [], hasUnread: false, unreadChannelRefs: [], lastErrorCode: null };

export class InboxClient {
  private readonly timers: TransportTimers;
  private readonly controller: ReconnectController;
  private socket: RealtimeSocket | null = null;
  private state: InboxClientState = INITIAL;
  private readonly listeners = new Set<(s: InboxClientState) => void>();
  private reauthAttempted = false;
  private reconnectTimer: ReturnType<TransportTimers['setTimeout']> | null = null;
  private closedByUs = false;
  /** Structured diagnostics emitter, or null when off (the default, zero-overhead). */
  private readonly diag: ChatClientDiagnosticsEmitter;
  /** Monotonic socket-open attempt counter (diagnostics correlation only). */
  private connectAttempt = 0;
  /** Why the CURRENT connect attempt is happening (diagnostics only). */
  private reconnectCause: 'initial' | 'auth-expired' | 'transient-close' | 'grant-error' = 'initial';
  /** The last close code observed, carried into the next attempt's cause line. */
  private lastCloseCode: number | null = null;

  constructor(private readonly config: InboxClientConfig) {
    this.timers = config.timers ?? defaultTimers;
    this.controller = createReconnectController(config.reconnect ?? {});
    this.diag = createDiagnosticsEmitter(config.diagnostics);
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
    this.closedByUs = false;
    this.reconnectCause = 'initial';
    this.controller.start();
    this.setState({ status: 'connecting' });
    await this.openSocket();
  }

  private async openSocket(): Promise<void> {
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
      // A TERMINAL access denial (the app translated an authoritative policy "no"
      // — e.g. Firebase `permission-denied` for a banned/suspended account — into the
      // package-owned ChatAccessDeniedError) must NOT reconnect: the next mint would
      // just re-deny, reconnect-looping forever and warning every cycle. Every other
      // mint failure (network/transient) stays retryable and backs off as before.
      const terminal = isChatAccessDeniedError(err);
      this.diag?.(DIAG.INBOX_GRANT_FAILED, { attempt: this.connectAttempt, terminal });
      if (terminal) return this.denyAccessTerminally();
      this.reconnectCause = 'grant-error';
      return this.scheduleReconnect();
    }
    if (this.closedByUs) return;
    const url = `${this.config.endpoint.replace(/\/$/, '')}/inbox`;
    this.socket = this.config.socketFactory({
      url,
      grantToken,
      handlers: {
        onOpen: () => this.onOpen(),
        onMessage: (data) => this.onMessage(data),
        onClose: (code, reason) => this.onClose(code, reason),
        onError: () => undefined,
      },
    });
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
      this.setState({ status: 'closed', lastErrorCode: 'revoked' });
      return;
    }
    this.reconnectCause = 'transient-close';
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
    this.setState({ status: 'closed', lastErrorCode: 'access-denied' });
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
      return;
    }
    this.setState({ status: 'reconnecting' });
    this.reconnectTimer = this.timers.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.closedByUs) return;
      void this.openSocket();
    }, delay);
  }

  private onMessage(data: string): void {
    const frame = parseFrame(data);
    if (!frame || !frame.payload) {
      this.diag?.(DIAG.INBOX_FRAME_DROPPED, { kind: 'unparseable', reason: 'bad-envelope' });
      return;
    }
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
    this.setState({ registry, hasUnread, unreadChannelRefs });
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
   * controls). Sends `mark-read` on the inbox socket; the inbox DO advances the
   * member's read cursor to tail on the channel DO and then pushes a fresh
   * authoritative snapshot, which is what removes the row — there is NO optimistic
   * local clear, so a failed mark-read honestly leaves the dot in place.
   * Returns false when the socket is not open (the caller may surface a retry).
   */
  markRead(channelRef: string): boolean {
    const sent = this.sendFrame(CLIENT_FRAME.MARK_READ, { channelRef });
    // The ref itself is never logged — only that a mark-read was written and what the
    // unread projection looked like at that moment (the DO's snapshot is what clears it).
    this.diag?.(DIAG.INBOX_MARK_READ, { sent, unreadCount: this.state.unreadChannelRefs.length });
    return sent;
  }

  /** Permanently close (auth-user switch / unmount). Idempotent. */
  close(): void {
    this.closedByUs = true;
    this.controller.close();
    if (this.reconnectTimer != null) {
      this.timers.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close(1000, 'client teardown');
      this.socket = null;
    }
    this.setState({ status: 'closed' });
  }
}

/**
 * Derive the per-channel unread set from a snapshot. The current inbox DO snapshot
 * exposes a single `hasUnread` boolean (dock dot) + the active registry; it does
 * NOT yet enumerate which entries are unread. We surface a per-entry `unread`
 * field when the DO provides it (forward-compatible), else fall back to empty
 * per-row dots (the dock dot still lights). See the ASSUMPTIONS note in the docs.
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
