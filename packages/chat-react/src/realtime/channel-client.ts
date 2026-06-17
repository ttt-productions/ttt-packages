// The Channel realtime client: ONE WebSocket to a single channel DO, driving the
// Contract C wire protocol. Framework-neutral (a plain observable store the React
// hook subscribes to) so it is unit-testable with a mock socket and no React.
//
// Responsibilities (Contract C):
//   - connect via subprotocol auth (grant offered by the injected grantProvider)
//   - receive versioned `message` frames; server owns `seq`
//   - optimistic send keyed by clientMessageId, reconciled on the server `ack` seq
//   - explicit read acks (delivery != read; focus signals "read")
//   - typing (>= 2s coalesced per the V1 limit)
//   - presence-subscribe/-unsubscribe + a 20s client heartbeat
//   - reconnect (realtime-core controller) with a resume cursor -> snapshot then deltas
//   - history pagination over the socket (page <= 50, epoch-aware via seq)
//   - error codes incl. 4401 AUTH_EXPIRED -> re-mint a grant ONCE via grantProvider
//
// Timers are injected (setTimeout/clearTimeout/now) so tests run deterministically.

import { createReconnectController, type ReconnectController } from '@ttt-productions/realtime-core';
import type { ChatMessageV1 } from '@ttt-productions/chat-core';
import {
  CLIENT_FRAME,
  CHAT_CLOSE_CODES,
  buildFrame,
  parseFrame,
  isInboxSnapshot,
  type WireMessageRow,
  type WireChannelSnapshot,
} from './wire.js';
import type { RealtimeSocket, SocketFactory } from './socket.js';
import { wireRowToMessage, optimisticMessage, seqToMessageId } from './map.js';
import type { GrantProvider, TransportTimers, RealtimeStatus } from './shared.js';
import { defaultTimers, HEARTBEAT_MS, TYPING_COALESCE_MS, HISTORY_PAGE_MAX } from './shared.js';

export interface ChannelClientState {
  status: RealtimeStatus;
  /** Ordered ascending by seq; optimistic messages (no seq yet) sort to the tail. */
  messages: ChatMessageV1[];
  /** uids currently typing (cleared after ~TYPING_COALESCE_MS of silence). */
  typing: string[];
  /** uids the DO reports online (presence). Empty until presence-subscribe. */
  presence: string[];
  /** True while an older-history page request is in flight. */
  isFetchingOlder: boolean;
  /** False once a history page returns fewer than the requested limit (reached the head). */
  hasOlder: boolean;
  /** The last structured error code the DO sent (e.g. 'blocked-word', 'too-long', flood reason). */
  lastErrorCode: string | null;
}

export interface ChannelClientConfig {
  /** WebSocket endpoint base, e.g. `wss://chat.ttt.productions`. The client appends `/channel`. */
  endpoint: string;
  /** The logical thread id the UI keys on (used as ChatMessageV1.threadId). */
  threadId: string;
  /** The authenticated uid (sender identity for optimistic echoes + auth-switch guard). */
  currentUserId: string;
  /** Mints/refreshes a channel grant. Called on connect and once on a 4401 re-grant. */
  grantProvider: GrantProvider;
  socketFactory: SocketFactory;
  timers?: TransportTimers;
  /** Reconnect backoff tuning (forwarded to realtime-core). */
  reconnect?: { baseDelayMs?: number; maxDelayMs?: number; maxAttempts?: number | null; random?: () => number };
}

const INITIAL: ChannelClientState = {
  status: 'idle',
  messages: [],
  typing: [],
  presence: [],
  isFetchingOlder: false,
  hasOlder: true,
  lastErrorCode: null,
};

export class ChannelClient {
  private readonly timers: TransportTimers;
  private readonly controller: ReconnectController;
  private socket: RealtimeSocket | null = null;
  private state: ChannelClientState = INITIAL;
  private readonly listeners = new Set<(s: ChannelClientState) => void>();

  /** Resume cursor: highest seq we've durably applied. Sent on resume after reconnect. */
  private resumeSeq = 0;
  /** True after a `4401` re-grant has been attempted for the CURRENT connect cycle (once-only). */
  private reauthAttempted = false;
  private presenceSubscribed = false;
  private heartbeatTimer: ReturnType<TransportTimers['setTimeout']> | null = null;
  private typingTimers = new Map<string, ReturnType<TransportTimers['setTimeout']>>();
  private lastTypingSentAt = Number.NEGATIVE_INFINITY;
  private reconnectTimer: ReturnType<TransportTimers['setTimeout']> | null = null;
  private closedByUs = false;

  constructor(private readonly config: ChannelClientConfig) {
    this.timers = config.timers ?? defaultTimers;
    this.controller = createReconnectController(config.reconnect ?? {});
  }

  // ---- observable store ----

  getState(): ChannelClientState {
    return this.state;
  }

  subscribe(fn: (s: ChannelClientState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setState(patch: Partial<ChannelClientState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }

  // ---- connection lifecycle ----

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
      // Grant mint failed — treat as a closed attempt and back off.
      return this.scheduleReconnect();
    }
    if (this.closedByUs) return;
    const url = `${this.config.endpoint.replace(/\/$/, '')}/channel`;
    this.socket = this.config.socketFactory({
      url,
      grantToken,
      handlers: {
        onOpen: () => this.onOpen(),
        onMessage: (data) => this.onMessage(data),
        onClose: (code, reason) => this.onClose(code, reason),
        onError: () => this.onError(),
      },
    });
  }

  private onOpen(): void {
    this.controller.onOpen();
    this.reauthAttempted = false;
    this.setState({ status: 'open' });
    // Resume: ask the DO for the authoritative snapshot, then live deltas flow.
    this.sendFrame(CLIENT_FRAME.RESUME, { ackSeq: this.resumeSeq });
    // If the UI had presence open, re-subscribe after a reconnect.
    if (this.presenceSubscribed) this.sendFrame(CLIENT_FRAME.PRESENCE_SUBSCRIBE, {});
    this.startHeartbeat();
  }

  private onError(): void {
    // The close handler does the backoff; onerror is advisory in browsers.
  }

  private onClose(code: number, _reason: string): void {
    this.stopHeartbeat();
    this.socket = null;
    if (this.closedByUs) {
      this.setState({ status: 'closed' });
      return;
    }
    // 4401 AUTH_EXPIRED: re-mint a grant ONCE and reconnect immediately, no backoff.
    if (code === CHAT_CLOSE_CODES.AUTH_EXPIRED && !this.reauthAttempted) {
      this.reauthAttempted = true;
      this.setState({ status: 'reconnecting' });
      void this.openSocket();
      return;
    }
    // 4403 REVOKED: access pulled. Stop — a reconnect would just re-deny at mint.
    if (code === CHAT_CLOSE_CODES.REVOKED) {
      this.closedByUs = true;
      this.controller.close();
      this.setState({ status: 'closed', lastErrorCode: 'revoked' });
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

  // ---- inbound frames ----

  private onMessage(data: string): void {
    const frame = parseFrame(data);
    if (!frame || !frame.type) return;
    const payload = frame.payload ?? {};
    switch (frame.type) {
      case 'message':
        return this.applyMessage((payload as { message: WireMessageRow }).message);
      case 'ack':
        return this.applyAck(payload as { clientMessageId?: string; seq?: number; readSeq?: number });
      case 'history-page':
        return this.applyHistoryPage((payload as { messages: WireMessageRow[] }).messages ?? []);
      case 'presence':
        return this.setState({ presence: (payload as { online: string[] }).online ?? [] });
      case 'typing':
        return this.applyTyping((payload as { uid: string }).uid);
      case 'snapshot':
        return this.applyChannelSnapshot(payload as unknown as WireChannelSnapshot);
      case 'error':
        return this.setState({ lastErrorCode: String((payload as { code: string }).code ?? 'error') });
      default:
        return; // unknown/optional types tolerated (forward compat)
    }
  }

  private applyChannelSnapshot(snap: WireChannelSnapshot): void {
    // Guard: an inbox snapshot must never reach a channel client.
    if (isInboxSnapshot(snap as never)) return;
    // The snapshot tells us the authoritative tail + our read cursor. If the DO's
    // tail is ahead of what we have, a missed delta is repaired by a history fetch.
    if (typeof snap.lastMessageSeq === 'number' && snap.lastMessageSeq > this.resumeSeq) {
      // We've reconnected and may have gaps below the tail — pull the latest page.
      this.requestHistory(null);
    }
  }

  private applyMessage(row: WireMessageRow): void {
    if (!row || typeof row.seq !== 'number') return;
    const mapped = wireRowToMessage(row, this.config.threadId);
    this.mergeMessage(mapped, row);
    if (row.seq > this.resumeSeq) this.resumeSeq = row.seq;
  }

  /**
   * Merge a server message: reconcile an optimistic echo by clientMessageId (swap
   * the `optimistic:` row for the canonical seq row), or insert/replace by seq.
   * Keeps the list sorted ascending by seq with optimistic rows at the tail.
   */
  private mergeMessage(mapped: ChatMessageV1, row: WireMessageRow): void {
    const next = this.state.messages.filter(
      (m) =>
        m.messageId !== mapped.messageId &&
        // drop the optimistic placeholder this server row reconciles
        (m.meta?.clientMessageId !== row.clientMessageId || !m.meta?.optimistic),
    );
    next.push(mapped);
    next.sort(sortBySeq);
    this.setState({ messages: next });
  }

  private applyAck(payload: { clientMessageId?: string; seq?: number; readSeq?: number }): void {
    // A read-ack echo carries readSeq only — nothing to reconcile locally.
    if (payload.clientMessageId == null || typeof payload.seq !== 'number') return;
    // Reconcile the optimistic echo: stamp the server seq onto it. The canonical
    // `message` broadcast (which the sender also receives) replaces it fully; this
    // ack guarantees the seq even if the broadcast is dropped/reordered.
    const seq = payload.seq;
    const cmid = payload.clientMessageId;
    const next = this.state.messages.map((m) =>
      m.meta?.optimistic && m.meta?.clientMessageId === cmid
        ? { ...m, messageId: seqToMessageId(seq), meta: { ...m.meta, optimistic: false, seq } }
        : m,
    );
    next.sort(sortBySeq);
    if (seq > this.resumeSeq) this.resumeSeq = seq;
    this.setState({ messages: next });
  }

  private applyHistoryPage(rows: WireMessageRow[]): void {
    const mapped = rows.map((r) => wireRowToMessage(r, this.config.threadId));
    const bySeq = new Map<string, ChatMessageV1>();
    for (const m of this.state.messages) bySeq.set(m.messageId, m);
    for (const m of mapped) bySeq.set(m.messageId, m);
    const merged = [...bySeq.values()].sort(sortBySeq);
    for (const r of rows) if (r.seq > this.resumeSeq) this.resumeSeq = r.seq;
    this.setState({
      messages: merged,
      isFetchingOlder: false,
      hasOlder: rows.length >= HISTORY_PAGE_MAX,
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

  // ---- outbound actions ----

  private sendFrame(type: string, payload: Record<string, unknown>): boolean {
    if (!this.socket || !this.socket.isOpen) return false;
    this.socket.send(buildFrame(type, payload));
    return true;
  }

  /**
   * Optimistic send: render the echo immediately keyed by clientMessageId, then
   * emit the `send` frame. The server `ack`/`message` reconciles on the seq.
   */
  send(args: { clientMessageId: string; text: string; replyTo?: { messageSeq: number; preview: string } | null }): void {
    const now = this.timers.now();
    const echo = optimisticMessage({
      clientMessageId: args.clientMessageId,
      threadId: this.config.threadId,
      senderId: this.config.currentUserId,
      text: args.text,
      createdAt: now,
      replyTo: args.replyTo ? { messageId: seqToMessageId(args.replyTo.messageSeq), messagePreview: args.replyTo.preview } : null,
    });
    const next = [...this.state.messages, echo].sort(sortBySeq);
    this.setState({ messages: next, lastErrorCode: null });
    this.sendFrame(CLIENT_FRAME.SEND, {
      clientMessageId: args.clientMessageId,
      text: args.text,
      replyTo: args.replyTo ?? null,
    });
  }

  /** Explicit read ack (delivery != read). `focused` => the channel is open + at latest. */
  readAck(readSeq: number, focused: boolean): void {
    this.sendFrame(CLIENT_FRAME.READ_ACK, { readSeq, focused });
  }

  /** Coalesced typing signal: at most one frame per TYPING_COALESCE_MS. */
  typing(): void {
    const now = this.timers.now();
    if (now - this.lastTypingSentAt < TYPING_COALESCE_MS) return;
    this.lastTypingSentAt = now;
    this.sendFrame(CLIENT_FRAME.TYPING, {});
  }

  presenceSubscribe(): void {
    this.presenceSubscribed = true;
    this.sendFrame(CLIENT_FRAME.PRESENCE_SUBSCRIBE, {});
  }

  presenceUnsubscribe(): void {
    this.presenceSubscribed = false;
    this.sendFrame(CLIENT_FRAME.PRESENCE_UNSUBSCRIBE, {});
    this.setState({ presence: [] });
  }

  /** Fetch the page of history older than the oldest loaded message (epoch-aware by seq). */
  fetchOlder(): void {
    if (this.state.isFetchingOlder || !this.state.hasOlder) return;
    const oldest = this.state.messages.find((m) => typeof m.meta?.seq === 'number');
    const beforeSeq = oldest && typeof oldest.meta?.seq === 'number' ? (oldest.meta.seq as number) : null;
    this.setState({ isFetchingOlder: true });
    this.requestHistory(beforeSeq);
  }

  private requestHistory(beforeSeq: number | null): void {
    this.sendFrame(CLIENT_FRAME.HISTORY, { beforeSeq, limit: HISTORY_PAGE_MAX });
  }

  // ---- heartbeat (20s) ----

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const tick = () => {
      if (!this.socket || !this.socket.isOpen) return;
      this.sendFrame(CLIENT_FRAME.HEARTBEAT, {});
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

  // ---- teardown ----

  /** Permanently close this client (auth-user switch / unmount). Idempotent. */
  close(): void {
    this.closedByUs = true;
    this.controller.close();
    this.stopHeartbeat();
    for (const t of this.typingTimers.values()) this.timers.clearTimeout(t);
    this.typingTimers.clear();
    if (this.reconnectTimer != null) {
      this.timers.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close(1000, 'client teardown');
      this.socket = null;
    }
    this.setState({ status: 'closed', typing: [], presence: [] });
  }
}

function sortBySeq(a: ChatMessageV1, b: ChatMessageV1): number {
  const sa = typeof a.meta?.seq === 'number' ? (a.meta.seq as number) : Number.POSITIVE_INFINITY;
  const sb = typeof b.meta?.seq === 'number' ? (b.meta.seq as number) : Number.POSITIVE_INFINITY;
  if (sa !== sb) return sa - sb;
  return a.createdAt - b.createdAt;
}
