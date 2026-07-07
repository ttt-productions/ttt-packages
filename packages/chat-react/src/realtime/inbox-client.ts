// The Inbox realtime client: a SEPARATE WebSocket (scope `inbox`) to the user's
// inbox DO. It maintains the channel/invite registry + unread projection that
// drives the Chats view — DOTS ONLY, no counts (Contract C / "Unread + inbox").
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
import { defaultTimers } from './shared.js';

export interface InboxClientState {
  status: RealtimeStatus;
  /** Active (non-tombstoned) channel/invite registry entries — Chats-view visibility. */
  registry: WireRegistryEntry[];
  /** True if ANY active channel/invite has unread (drives the dock dot). */
  hasUnread: boolean;
  /** The set of channelRefs that currently carry an unread dot (per-row dots). */
  unreadChannelRefs: string[];
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
}

const INITIAL: InboxClientState = { status: 'idle', registry: [], hasUnread: false, unreadChannelRefs: [] };

export class InboxClient {
  private readonly timers: TransportTimers;
  private readonly controller: ReconnectController;
  private socket: RealtimeSocket | null = null;
  private state: InboxClientState = INITIAL;
  private readonly listeners = new Set<(s: InboxClientState) => void>();
  private reauthAttempted = false;
  private reconnectTimer: ReturnType<TransportTimers['setTimeout']> | null = null;
  private closedByUs = false;

  constructor(private readonly config: InboxClientConfig) {
    this.timers = config.timers ?? defaultTimers;
    this.controller = createReconnectController(config.reconnect ?? {});
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
    this.controller.start();
    this.setState({ status: 'connecting' });
    await this.openSocket();
  }

  private async openSocket(): Promise<void> {
    let grantToken: string;
    try {
      grantToken = await this.config.grantProvider();
    } catch {
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
    // The DO sends a snapshot on accept; a `resume` re-requests it after a reconnect gap.
    this.sendFrame(CLIENT_FRAME.RESUME, {});
  }

  private onClose(code: number, _reason: string): void {
    this.socket = null;
    if (this.closedByUs) {
      this.setState({ status: 'closed' });
      return;
    }
    if (code === CHAT_CLOSE_CODES.AUTH_EXPIRED && !this.reauthAttempted) {
      this.reauthAttempted = true;
      this.setState({ status: 'reconnecting' });
      void this.openSocket();
      return;
    }
    if (code === CHAT_CLOSE_CODES.REVOKED) {
      this.closedByUs = true;
      this.controller.close();
      this.setState({ status: 'closed' });
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    const delay = this.controller.onClose();
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
    if (!frame || !frame.payload) return;
    // The inbox DO pushes a full `snapshot`; a future lightweight `unread` push
    // carries either a full snapshot or a `{ hasUnread }` dock-dot patch. Route both
    // instead of silently dropping the `unread` type (C-M2).
    if (frame.type !== 'snapshot' && frame.type !== 'unread') return;
    const payload = frame.payload as unknown as WireInboxSnapshot | { hasUnread: boolean };
    if (isInboxSnapshot(payload as WireInboxSnapshot)) {
      this.applySnapshot(payload as WireInboxSnapshot);
    } else if (frame.type === 'unread' && typeof (payload as { hasUnread?: unknown }).hasUnread === 'boolean') {
      this.setState({ hasUnread: Boolean((payload as { hasUnread: boolean }).hasUnread) });
    }
  }

  private applySnapshot(snap: WireInboxSnapshot): void {
    // Keep every non-tombstoned entry — including ARCHIVED rows — so the Chats view can
    // render both the active list and the Archived toggle. `archived` is a distinct
    // dimension from `tombstoned`; archived rows are still `state: 'active'`.
    const registry = snap.registry.filter((e) => e.state === 'active');
    // The DO's `hasUnread` is the authoritative dock dot. Per-row dots are derived from
    // the same projection but exclude ARCHIVED rows (archive = done — an archived row
    // never shows a dot). The DO clears unread on archive, so this is belt-and-braces.
    this.setState({
      registry,
      hasUnread: Boolean(snap.hasUnread),
      unreadChannelRefs: deriveUnreadRefs(snap),
    });
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
   * Clear a channel/invite's unread WITHOUT opening it (the Chats-tray X / go-to
   * controls). Sends `mark-read` on the inbox socket; the inbox DO advances the
   * member's read cursor to tail on the channel DO and then pushes a fresh
   * authoritative snapshot, which is what removes the row — there is NO optimistic
   * local clear, so a failed mark-read honestly leaves the dot in place.
   * Returns false when the socket is not open (the caller may surface a retry).
   */
  markRead(channelRef: string): boolean {
    return this.sendFrame(CLIENT_FRAME.MARK_READ, { channelRef });
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
