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
  type RevisionKind,
} from './wire.js';
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
  defaultTimers,
  HEARTBEAT_MS,
  TYPING_COALESCE_MS,
  HISTORY_PAGE_MAX,
  MAX_PENDING_SEND_ATTEMPTS,
  PENDING_SEND_MAX_AGE_MS,
} from './shared.js';

/** An un-acked send tracked for reconnect resend (clientMessageId idempotency). */
interface PendingSend {
  clientMessageId: string;
  text: string;
  replyTo: { messageSeq: number; preview: string } | null;
  /** When the send was first attempted (for the age cap). Reset by retrySend(). */
  sentAt: number;
  /** How many times it has been (re)sent over a socket. Reset by retrySend(). */
  attempts: number;
  /** True once the attempt/age cap flipped this send to the visible failed state.
   *  A failed entry is RETAINED (not deleted) so retrySend() can re-queue it with
   *  the SAME clientMessageId; it is skipped by the automatic reconnect resend. */
  failed: boolean;
}

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

/**
 * Retryable error-frame code the channel DO sends when a send arrives BEFORE the
 * member row has synced through the async backend→worker pipeline (a just-created
 * invite/channel). The socket stays open; the client re-sends after `retryAfterMs`
 * through the normal resendPendingSends machinery (same caps). The string is the
 * wire contract with chat-worker's handleSend — change both together.
 */
const MEMBERSHIP_PENDING_CODE = 'membership-pending';
/** Fallback retry delay when the frame omits/breaks `retryAfterMs`. */
const MEMBERSHIP_PENDING_DEFAULT_RETRY_MS = 2000;

export class ChannelClient {
  private readonly timers: TransportTimers;
  private readonly controller: ReconnectController;
  private socket: RealtimeSocket | null = null;
  private state: ChannelClientState = INITIAL;
  private readonly listeners = new Set<(s: ChannelClientState) => void>();

  /** Resume cursor: highest seq we've durably applied. Sent on resume after reconnect. */
  private resumeSeq = 0;
  /** Last read-ack the UI requested; re-sent on reconnect so a drop during a closed
   *  socket window is recovered (M2). */
  private lastReadAck: { readSeq: number; focused: boolean } | null = null;
  /** True after a `4401` re-grant has been attempted for the CURRENT connect cycle (once-only). */
  private reauthAttempted = false;
  private presenceSubscribed = false;
  private heartbeatTimer: ReturnType<TransportTimers['setTimeout']> | null = null;
  private typingTimers = new Map<string, ReturnType<TransportTimers['setTimeout']>>();
  private lastTypingSentAt = Number.NEGATIVE_INFINITY;
  private reconnectTimer: ReturnType<TransportTimers['setTimeout']> | null = null;
  /** Single scheduled re-send for the membership-pending window (never stacks). */
  private membershipRetryTimer: ReturnType<TransportTimers['setTimeout']> | null = null;
  private closedByUs = false;
  /**
   * Per-seq moderation overlay (the max-revision wins). A `revision` frame writes
   * here keyed by `messageSeq` so it applies whether it arrives BEFORE its base
   * row (re-applied when the row later renders) or AFTER (re-renders the present
   * row in place). Merged with the row's own inline `moderationKind` so a row that
   * arrives already-moderated from the DO AND one covered by a live frame both
   * render the moderated state. */
  private overlays = new Map<number, ModerationOverlay>();
  /**
   * The ORIGINAL (un-overlaid) mapped message per seq. A `restore` revision must
   * revert a previously-redacted message to its original text, so re-renders start
   * from this cache rather than the (possibly already-blanked) message in state. */
  private originalRows = new Map<number, ChatMessageV1>();
  /**
   * Un-acked sends keyed by clientMessageId. A send is added here when its frame is
   * written and removed when its `ack` (or the canonical `message` echo carrying the
   * same clientMessageId) arrives. On every reconnect resume they are RE-SENT with
   * the SAME clientMessageId — the DO dedups (re-acks without re-broadcast), so a
   * send that lost its socket before the ack is delivered exactly once. A pending
   * send that exceeds the attempt/age cap is flipped to a visible failed state
   * (retry affordance) instead of staying a ghost. */
  private pendingSends = new Map<string, PendingSend>();

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
    // Idempotency guard (C-B7): connect() only starts a lifecycle from a fresh
    // (idle) or fully torn-down (closed) state. A second connect() while one is
    // already connecting / open / reconnecting is a no-op, so a stray double-owner
    // can't open a second WebSocket. The reconnect path uses openSocket() /
    // scheduleReconnect() directly (never connect()), so this never blocks a
    // legitimate reconnect.
    if (this.state.status !== 'idle' && this.state.status !== 'closed') return;
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
    // Resume: ask the DO for the authoritative snapshot, then live deltas flow. The
    // field name MUST be `afterSeq` — the Channel DO reads `payload.afterSeq`; any other
    // name reads as cursorless and forces a full resync every reconnect.
    this.sendFrame(CLIENT_FRAME.RESUME, { afterSeq: this.resumeSeq });
    // If the UI had presence open, re-subscribe after a reconnect.
    if (this.presenceSubscribed) this.sendFrame(CLIENT_FRAME.PRESENCE_SUBSCRIBE, {});
    // Re-send the last read cursor so a read-ack dropped during the disconnect window
    // (sendFrame returns false on a closed socket) is not lost until the next message.
    if (this.lastReadAck) this.sendFrame(CLIENT_FRAME.READ_ACK, { ...this.lastReadAck });
    // Re-send every un-acked pending send with its ORIGINAL clientMessageId so a send
    // that lost its socket before the ack is not silently dropped. The DO dedups
    // (re-acks, no re-broadcast, no flood-token) — this is the client half of the
    // Contract C send-idempotency the server side was built for.
    this.resendPendingSends();
    this.startHeartbeat();
  }

  /**
   * On reconnect, re-send each un-acked pending send with the SAME clientMessageId
   * (the DO dedups). A send that has exceeded the attempt or age cap is flipped to a
   * visible failed state instead of being resent forever — the ghost becomes a
   * retryable failure the UI can surface.
   */
  private resendPendingSends(): void {
    if (this.pendingSends.size === 0) return;
    const now = this.timers.now();
    for (const pending of [...this.pendingSends.values()]) {
      // Already flipped to the visible failed state — only an explicit retrySend()
      // re-queues it; the automatic reconnect resend leaves it alone.
      if (pending.failed) continue;
      const tooOld = now - pending.sentAt >= PENDING_SEND_MAX_AGE_MS;
      const tooManyAttempts = pending.attempts >= MAX_PENDING_SEND_ATTEMPTS;
      if (tooOld || tooManyAttempts) {
        this.failPendingSend(pending.clientMessageId);
        continue;
      }
      const sent = this.sendFrame(CLIENT_FRAME.SEND, {
        clientMessageId: pending.clientMessageId,
        text: pending.text,
        replyTo: pending.replyTo,
      });
      if (sent) pending.attempts += 1;
    }
  }

  /**
   * Flip an un-acked optimistic row to a visible failed state. The pending entry is
   * RETAINED (marked `failed`) so retrySend() can re-queue it with the SAME
   * clientMessageId; the row is marked `meta.sendFailed` so the default renderer
   * shows a failure with a retry affordance rather than an indistinguishable
   * "sent" bubble. A late ack/echo still reconciles + clears it.
   */
  private failPendingSend(clientMessageId: string): void {
    const pending = this.pendingSends.get(clientMessageId);
    if (!pending || pending.failed) return;
    pending.failed = true;
    const next = this.state.messages.map((m) =>
      m.meta?.optimistic && m.meta?.clientMessageId === clientMessageId
        ? { ...m, meta: { ...m.meta, sendFailed: true } }
        : m,
    );
    this.setState({ messages: next, lastErrorCode: 'send-failed' });
  }

  /** One timer for the membership-pending re-send window; a newer frame resets it. */
  private scheduleMembershipPendingRetry(delayMs: number): void {
    if (this.membershipRetryTimer != null) this.timers.clearTimeout(this.membershipRetryTimer);
    this.membershipRetryTimer = this.timers.setTimeout(() => {
      this.membershipRetryTimer = null;
      if (this.closedByUs) return;
      this.resendPendingSends();
    }, delayMs);
  }

  /**
   * Flip EVERY un-acked pending send to the visible failed state. Called on the
   * terminal close paths (4403 REVOKED, reconnect give-up) — without this, a send
   * in flight when the socket dies for good shows "Sending…" until unmount.
   */
  private failAllPendingSends(): void {
    for (const clientMessageId of [...this.pendingSends.keys()]) {
      this.failPendingSend(clientMessageId);
    }
  }

  /**
   * Retry a FAILED (or still-pending) send, RE-USING its original clientMessageId
   * so the DO's send-idempotency dedups against any copy that actually landed.
   * Resets the attempt/age budget, clears the row's `sendFailed` marker (back to
   * the normal pending/optimistic look), and re-sends immediately when the socket
   * is open — otherwise the entry rides the next reconnect's automatic resend.
   * Returns false when the clientMessageId is not a tracked pending send (already
   * acked/reconciled, or never sent from this client).
   */
  retrySend(clientMessageId: string): boolean {
    const pending = this.pendingSends.get(clientMessageId);
    if (!pending) return false;
    pending.failed = false;
    pending.sentAt = this.timers.now();
    const sent = this.sendFrame(CLIENT_FRAME.SEND, {
      clientMessageId: pending.clientMessageId,
      text: pending.text,
      replyTo: pending.replyTo,
    });
    pending.attempts = sent ? 1 : 0;
    const next = this.state.messages.map((m) =>
      m.meta?.optimistic && m.meta?.clientMessageId === clientMessageId && m.meta?.sendFailed
        ? { ...m, meta: { ...m.meta, sendFailed: false } }
        : m,
    );
    this.setState({ messages: next, lastErrorCode: null });
    return true;
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
    // Terminal: flip every un-acked pending send to the visible failed state first
    // (failPendingSend sets lastErrorCode 'send-failed'; the 'revoked' set below
    // wins as the final surfaced code).
    if (code === CHAT_CLOSE_CODES.REVOKED) {
      this.closedByUs = true;
      this.controller.close();
      this.failAllPendingSends();
      this.setState({ status: 'closed', lastErrorCode: 'revoked' });
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    const delay = this.controller.onClose();
    if (delay == null) {
      // Reconnect give-up: terminal, same as REVOKED — pending sends must not stay
      // an eternal "Sending…"; flip them to the visible failed/retry state.
      this.failAllPendingSends();
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
      case 'error': {
        const code = String((payload as { code?: unknown }).code ?? 'error');
        // Retryable: membership row not yet synced to the DO. Keep the send pending
        // (no visible error — the optimistic bubble stays "Sending…") and re-send
        // after the server-suggested delay via the normal resend machinery, whose
        // attempt/age caps flip it to the visible failed state if the window never
        // closes. Everything else surfaces as before.
        if (code === MEMBERSHIP_PENDING_CODE) {
          const raw = (payload as { retryAfterMs?: unknown }).retryAfterMs;
          const delay = typeof raw === 'number' && raw > 0 ? raw : MEMBERSHIP_PENDING_DEFAULT_RETRY_MS;
          return this.scheduleMembershipPendingRetry(delay);
        }
        return this.setState({ lastErrorCode: code });
      }
      case 'revision':
        return this.applyRevisionFrame(payload as { messageSeq?: number; kind?: RevisionKind; messageRevision?: number });
      default:
        return; // unknown/optional types tolerated (forward compat)
    }
  }

  /**
   * Apply a live moderation `revision` frame: record the overlay keyed by seq
   * (max-`messageRevision` wins — a stale/older frame is ignored) and re-render the
   * matching message in place if it is already loaded. If the base row hasn't
   * arrived yet the overlay is retained and re-applied when the row renders, so a
   * frame that races ahead of its message never lets the original content show.
   */
  private applyRevisionFrame(payload: { messageSeq?: number; kind?: RevisionKind; messageRevision?: number }): void {
    const seq = payload.messageSeq;
    const kind = payload.kind;
    const messageRevision = payload.messageRevision;
    if (typeof seq !== 'number' || kind == null || typeof messageRevision !== 'number') return;
    const prev = this.overlays.get(seq);
    // Max-revision merge: a higher messageRevision supersedes; an older one is dropped.
    if (prev && prev.messageRevision >= messageRevision) return;
    this.overlays.set(seq, { kind, messageRevision });
    // Re-render the matching message in place if it is already present. Re-derive
    // from the ORIGINAL row so a `restore` reverts a previously-blanked text.
    const messageId = seqToMessageId(seq);
    const original = this.originalRows.get(seq);
    if (original && this.state.messages.some((m) => m.messageId === messageId)) {
      const overlaid = applyModerationOverlay(original, this.effectiveOverlay(seq, null));
      const next = this.state.messages.map((m) => (m.messageId === messageId ? overlaid : m));
      this.setState({ messages: next });
    }
  }

  /**
   * The effective overlay for a seq = the max-`messageRevision` between the row's
   * own inline overlay (from the DO history/delta merge) and any received `revision`
   * frame stored in `this.overlays`. Either source may be ahead of the other.
   */
  private effectiveOverlay(seq: number, rowOverlay: ModerationOverlay | null): ModerationOverlay | null {
    const fromFrame = this.overlays.get(seq) ?? null;
    if (!rowOverlay) return fromFrame;
    if (!fromFrame) return rowOverlay;
    return fromFrame.messageRevision >= rowOverlay.messageRevision ? fromFrame : rowOverlay;
  }

  /** Map a DO row to a UI message with its effective moderation overlay applied. */
  private renderRow(row: WireMessageRow): ChatMessageV1 {
    const mapped = wireRowToMessage(row, this.config.threadId);
    // Cache the ORIGINAL so a later `restore` frame can revert a blanked message.
    this.originalRows.set(row.seq, mapped);
    return applyModerationOverlay(mapped, this.effectiveOverlay(row.seq, overlayFromRow(row)));
  }

  /**
   * Apply the Contract C resume snapshot. The DO always returns the authoritative
   * tail + read cursor and, per the pinned contract, EITHER a contiguous delta
   * (`resync:false`) OR a resync directive (`resync:true`).
   *
   * - `resync === false`: apply the contiguous `delta` (the ≤500-message backlog
   *   after our cursor, oldest-first) through the same render/merge path as a live
   *   `message`, then advance `resumeSeq` to `lastMessageSeq`. This heals ANY gap
   *   within the backlog — including moderation `revision`s the DO baked into the
   *   delta rows — with no history fetch, so a >50-message reconnect gap is no
   *   longer a permanent hole.
   * - `resync === true`: the gap is beyond the backlog (or we sent no cursor). Drop
   *   the local tail (messages + overlays + original-row cache) and re-page history
   *   from the top via a cursorless `requestHistory(null)`.
   *
   * A pre-contract DO (no `resync`/`delta`) is treated as `resync:true` ⇒ the safe
   * re-page path, so a stale worker never strands the client. An empty delta with
   * `resync:false` (already caught up) is a no-op beyond advancing the cursor.
   */
  private applyChannelSnapshot(snap: WireChannelSnapshot): void {
    // Guard: an inbox snapshot must never reach a channel client.
    if (isInboxSnapshot(snap as never)) return;
    if (typeof snap.lastMessageSeq !== 'number') return;

    // Absent `resync` (legacy/pre-contract DO) is treated as a resync directive.
    const resync = snap.resync !== false;

    if (!resync) {
      // Apply the contiguous delta oldest-first, exactly like live messages, then
      // advance the cursor to the authoritative tail so the NEXT resume tells the DO
      // we're caught up only after we actually applied the backlog.
      const delta = Array.isArray(snap.delta) ? snap.delta : [];
      for (const row of delta) this.applyMessage(row);
      if (snap.lastMessageSeq > this.resumeSeq) this.resumeSeq = snap.lastMessageSeq;
      return;
    }

    // Resync: drop the local tail and re-page from the top per the pinned contract.
    // Clear the derived caches too so a stale overlay/original-row can't resurrect a
    // message the re-page will reload fresh (with its baked-in moderation state).
    // KEEP un-acked optimistic rows — they aren't server history yet; their pending
    // sends were already re-sent in onOpen and reconcile when the DO echoes them.
    this.overlays.clear();
    this.originalRows.clear();
    this.resumeSeq = 0;
    const keptOptimistic = this.state.messages.filter((m) => m.meta?.optimistic);
    this.setState({ messages: keptOptimistic, hasOlder: true, isFetchingOlder: false });
    this.requestHistory(null);
  }

  private applyMessage(row: WireMessageRow): void {
    if (!row || typeof row.seq !== 'number') return;
    const mapped = this.renderRow(row);
    this.mergeMessage(mapped, row);
    if (row.seq > this.resumeSeq) this.resumeSeq = row.seq;
  }

  /**
   * Merge a server message: reconcile an optimistic echo by clientMessageId (swap
   * the `optimistic:` row for the canonical seq row), or insert/replace by seq.
   * Keeps the list sorted ascending by seq with optimistic rows at the tail.
   */
  private mergeMessage(mapped: ChatMessageV1, row: WireMessageRow): void {
    // If this canonical row carries a clientMessageId we still have pending (the
    // sender's own broadcast, or a resume delta that included our send), the send
    // landed — stop tracking it for reconnect resend.
    if (row.clientMessageId) this.pendingSends.delete(row.clientMessageId);
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
    // The send is acked — stop tracking it for reconnect resend.
    this.pendingSends.delete(cmid);
    const next = this.state.messages.map((m) => {
      if (!m.meta?.optimistic || m.meta?.clientMessageId !== cmid) return m;
      // Strip any failed marker — a late ack (e.g. a retry raced the cap) means the
      // send actually landed, so the row must render as delivered, not failed.
      const { sendFailed: _sendFailed, ...restMeta } = m.meta;
      return { ...m, messageId: seqToMessageId(seq), meta: { ...restMeta, optimistic: false, seq } };
    });
    next.sort(sortBySeq);
    if (seq > this.resumeSeq) this.resumeSeq = seq;
    this.setState({ messages: next });
  }

  private applyHistoryPage(rows: WireMessageRow[]): void {
    const mapped = rows.map((r) => this.renderRow(r));
    // Mirror mergeMessage's optimistic reconciliation: a history row carrying a
    // clientMessageId we still hold as an optimistic placeholder IS that send (the
    // DO stored it; the ack was lost). Drop the placeholder — keyed `optimistic:{cmid}`,
    // it would otherwise survive alongside its seq-keyed server row as a duplicate
    // bubble after a resync + re-page — and stop tracking it for resend.
    const incomingCmids = new Set<string>();
    for (const r of rows) {
      if (r.clientMessageId) {
        incomingCmids.add(r.clientMessageId);
        this.pendingSends.delete(r.clientMessageId);
      }
    }
    const bySeq = new Map<string, ChatMessageV1>();
    for (const m of this.state.messages) {
      if (m.meta?.optimistic && typeof m.meta?.clientMessageId === 'string' && incomingCmids.has(m.meta.clientMessageId)) {
        continue; // reconciled by the incoming server row
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
  send(args: { clientMessageId: string; text: string; replyTo?: { messageSeq: number; preview: string } | null }): boolean {
    // C-B8: write the frame FIRST and render the optimistic echo ONLY if it was
    // actually sent over an open socket. A closed socket returns false — no phantom
    // "sent" bubble, and the caller keeps the composer text — so a disconnect between
    // render and click can't silently swallow the message.
    const sent = this.sendFrame(CLIENT_FRAME.SEND, {
      clientMessageId: args.clientMessageId,
      text: args.text,
      replyTo: args.replyTo ?? null,
    });
    if (!sent) {
      this.setState({ lastErrorCode: 'send-failed' });
      return false;
    }
    const now = this.timers.now();
    // Track the un-acked send so a reconnect re-sends it with the same
    // clientMessageId (the DO dedups) — until the ack/echo clears it.
    this.pendingSends.set(args.clientMessageId, {
      clientMessageId: args.clientMessageId,
      text: args.text,
      replyTo: args.replyTo ?? null,
      sentAt: now,
      attempts: 1,
      failed: false,
    });
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
    return true;
  }

  /**
   * Explicit read ack (delivery != read). `focused` => the channel is open + at latest.
   * Remembers the cursor (re-sent on reconnect) and returns whether the frame was
   * actually sent over an open socket, so the caller only advances its local
   * already-acked marker on a real send (M2).
   */
  readAck(readSeq: number, focused: boolean): boolean {
    this.lastReadAck = { readSeq, focused };
    return this.sendFrame(CLIENT_FRAME.READ_ACK, { readSeq, focused });
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
    this.overlays.clear();
    this.originalRows.clear();
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
