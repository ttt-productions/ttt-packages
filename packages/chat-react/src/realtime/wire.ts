// Chat realtime WIRE PROTOCOL (Contract C) — the client side of the Channel +
// Inbox Durable Object protocol. The canonical protocol declarations (subprotocol,
// frame-kind maps, close codes, channel-ref tuple, grant scope, client-agreed
// limits) are owned by `@ttt-productions/chat-schemas`; this file consumes them
// and adds the client-side raw row/frame shapes the transport maps into the UI
// message shape. The client and the worker runtime agree on the wire by both
// importing that one contract; neither imports the other.
//
// Frame shape on the socket is `{ v, type, payload }` (NOT realtime-core's
// `{ v, kind, payload }`): the worker runtime `send`/`broadcast` emit
// `JSON.stringify({ v: 1, type, payload })` and read `env.type` + `env.payload`.
// We keep that field name here to match; realtime-core's envelope schema is the
// generic transport primitive, the chat protocol chose `type` for its frames.

// Re-export the canonical wire contract so this package's public surface is
// unchanged. `CLIENT_FRAME`/`SERVER_FRAME` are this package's historical names
// for the frame-kind maps (`CLIENT_KINDS`/`SERVER_KINDS` in the contract).
export {
  CHAT_SUBPROTOCOL,
  CHAT_WIRE_VERSION,
  CHAT_CLOSE_CODES,
  CLIENT_KINDS as CLIENT_FRAME,
  SERVER_KINDS as SERVER_FRAME,
} from '@ttt-productions/chat-schemas';
export type { ChatCloseCode, ChannelRefTuple } from '@ttt-productions/chat-schemas';

import { CHAT_WIRE_VERSION } from '@ttt-productions/chat-schemas';
import type { ChannelRefTuple } from '@ttt-productions/chat-schemas';

// ---- raw wire row shapes (what the DO serializes; opaque-but-typed here) ----

/**
 * The moderation revision `kind` (the worker runtime's revision input + the
 * `revisions.kind` column). The EFFECTIVE state of a message is its
 * MAX-`messageRevision` row's kind, so a `restore` (a later revision) supersedes
 * an earlier `moderate`/`delete`. `moderate`/`delete` blank the original text;
 * `edit` overlays new text; `restore` reverts to the original.
 */
export type RevisionKind = 'delete' | 'moderate' | 'edit' | 'restore';

/**
 * A message row as the Channel DO stores + broadcasts it (the worker runtime's
 * message row). `replyTo`/`attachmentMeta` arrive as JSON STRINGS (or null) —
 * the DO stores them stringified and does not re-parse before broadcast. The
 * adapter mapping in `map.ts` parses them into the UI `ChatMessageV1` shape.
 */
export interface WireMessageRow {
  seq: number;
  senderUid: string;
  clientMessageId: string;
  text: string;
  replyTo: string | null;
  attachmentState: string | null;
  attachmentMeta: string | null;
  createdAt: number;
  epoch: number;
  /**
   * The effective (max-`messageRevision`) moderation kind for this row, or null
   * when never moderated. Populated by the DO's getHistory/getDeltaSince overlay
   * merge so a hidden/deleted/edited row arrives already-moderated and its
   * ORIGINAL text never reaches the renderer. Optional/absent on pre-overlay rows.
   */
  moderationKind?: RevisionKind | null;
  /**
   * The effective `messageRevision` that `moderationKind` reflects (the DO's
   * max-revision). Used to break ties against a live `revision` frame: a higher
   * `messageRevision` wins; a stale/older one is ignored. Optional/absent on
   * pre-overlay rows (treated as revision 0).
   */
  messageRevision?: number;
}

/**
 * The channel resume snapshot the DO returns for a `resume` frame (Contract C).
 * `resync` / `delta` are the durable gap-repair half of the contract:
 *  - `resync: false` + `delta` = the contiguous ≤500-message backlog after the
 *    client's cursor (oldest-first); the client APPLIES the delta and advances its
 *    cursor to `lastMessageSeq` — a missed broadcast is never permanent.
 *  - `resync: true` = the gap exceeds the backlog (or the client sent no cursor);
 *    the client DROPS its local tail and re-pages history from the top.
 * Both are OPTIONAL/absent on a pre-contract DO (treated as `resync: true`, empty
 * delta — the safe re-page path) so a stale worker can't leave a client stuck.
 */
export interface WireChannelSnapshot {
  lastMessageSeq: number;
  readSeq: number;
  resync?: boolean;
  delta?: WireMessageRow[];
}

/** A registry entry in the inbox snapshot (the worker runtime's registry entry). */
export interface WireRegistryEntry {
  channelRef: string;
  kind: string;
  state: 'active' | 'tombstoned';
  registryVersion: number;
  /**
   * The typed channel-ref tuple — the OPENABLE identity for the inbox view (the
   * `channelRef` is an opaque DO-id dedup key). Null/absent on legacy or pre-tuple
   * rows; the consumer falls back to hiding the open action for those entries.
   */
  ref?: ChannelRefTuple | null;
  /**
   * Per-entry unread flag (drives the per-row dot). Optional/absent until the inbox
   * DO populates it; `deriveUnreadRefs` reads it as a typed field (no cast).
   */
  unread?: boolean;
  /**
   * Archived state — DISTINCT from `tombstoned`. An archived row is still an ACTIVE
   * membership (`state: 'active'`, history readable) but is grouped under the inbox
   * view's Archived toggle instead of the active list. The client must NOT count
   * archived rows in the unread roll-up (archive = done; the DO clears unread on
   * archive). Optional/absent on a pre-archive DO (treated as not-archived).
   */
  archived?: boolean;
}

/** The inbox snapshot payload pushed on connect / `resume` / live delta. */
export interface WireInboxSnapshot {
  registry: WireRegistryEntry[];
  hasUnread: boolean;
}

// ---- server → client frame payloads (discriminated on `type`) ----

export type ServerFrame =
  | { type: 'message'; payload: { message: WireMessageRow } }
  | { type: 'ack'; payload: { clientMessageId?: string; seq?: number; readSeq?: number } }
  | { type: 'history-page'; payload: { messages: WireMessageRow[] } }
  | { type: 'presence'; payload: { online: string[] } }
  | { type: 'typing'; payload: { uid: string; at: number } }
  | { type: 'snapshot'; payload: WireChannelSnapshot | WireInboxSnapshot }
  // A standalone unread push (inbox scope): either a full inbox snapshot or a
  // lightweight dock-dot patch. Represented in the union so the inbox client routes
  // it instead of silently dropping it (forward-compatible with a future DO push).
  | { type: 'unread'; payload: WireInboxSnapshot | { hasUnread: boolean } }
  | { type: 'error'; payload: { code: string; retryAfterMs?: number } }
  // A moderation revision was applied to one message. The Channel DO broadcasts
  // this on a NEWLY-applied revision (the worker runtime's moderation apply) so live
  // viewers hide/blank/edit/restore the message immediately with no extra fetch.
  // `messageSeq` is the target message id; `kind` is the applied revision kind;
  // `messageRevision` is its per-message revision number (max-revision wins).
  | { type: 'revision'; payload: { messageSeq: number; kind: RevisionKind; messageRevision: number } };

/** Build an outbound `{ v, type, payload }` frame (the wire format the DO reads). */
export function buildFrame(type: string, payload: Record<string, unknown>): string {
  return JSON.stringify({ v: CHAT_WIRE_VERSION, type, payload });
}

/** Parse an inbound frame, tolerating malformed JSON. Returns null on garbage. */
export function parseFrame(raw: string): { v?: number; type?: string; payload?: Record<string, unknown> } | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as { v?: number; type?: string; payload?: Record<string, unknown> };
  } catch {
    return null;
  }
}

/** A snapshot with `registry` is an inbox snapshot; one with `lastMessageSeq` is a channel snapshot. */
export function isInboxSnapshot(p: WireChannelSnapshot | WireInboxSnapshot): p is WireInboxSnapshot {
  return Array.isArray((p as WireInboxSnapshot).registry);
}
