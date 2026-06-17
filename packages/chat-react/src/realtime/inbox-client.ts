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
    if (!frame || frame.type !== 'snapshot' || !frame.payload) return;
    const payload = frame.payload as unknown as WireInboxSnapshot;
    if (!isInboxSnapshot(payload)) return; // ignore a stray channel snapshot
    this.applySnapshot(payload);
  }

  private applySnapshot(snap: WireInboxSnapshot): void {
    const registry = snap.registry.filter((e) => e.state === 'active');
    // The DO's `hasUnread` is the authoritative dock dot. Per-row dots are derived
    // from the same projection: the DO only keeps unread for ACTIVE entries, and a
    // future snapshot field can carry per-channel unread; until then the dock dot
    // is authoritative and per-row unread is surfaced via the projected set below.
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
 */
function deriveUnreadRefs(snap: WireInboxSnapshot): string[] {
  const refs: string[] = [];
  for (const e of snap.registry) {
    if (e.state !== 'active') continue;
    if ((e as WireRegistryEntry & { unread?: boolean }).unread === true) refs.push(e.channelRef);
  }
  return refs;
}
