/**
 * Generic realtime wire envelopes (GENERIC — no TTT specifics).
 *
 * The client↔DO message envelope carries an app-defined `kind` + opaque
 * `payload`; the realtime layer only interprets the transport fields
 * (version, seq/ack for ordered streams, client message id for idempotency).
 * `VersionedSyncItem` is the neutral shape every authoritative projection /
 * command / outbox delivery takes, so the versioned-apply appliers can act on
 * it without knowing the domain.
 */

import { z } from 'zod';

/** Client↔DO transport envelope. `kind`/`payload` are app-defined; the rest is transport. */
export const RealtimeMessageEnvelopeSchema = z.object({
  /** Protocol version (see REALTIME_PROTOCOL_VERSION). */
  v: z.number(),
  /** App-defined message kind. */
  kind: z.string(),
  /** Server-assigned monotonic sequence for ordered streams (optional on control msgs). */
  seq: z.number().optional(),
  /** Highest seq the client has durably applied (resume/ack). */
  ackSeq: z.number().optional(),
  /** Client-chosen message id for at-least-once idempotency (dedup on the server). */
  clientMessageId: z.string().optional(),
  /** Opaque app payload. */
  payload: z.unknown(),
});
export type RealtimeMessageEnvelope = z.infer<typeof RealtimeMessageEnvelopeSchema>;

/**
 * The neutral shape of an authoritative versioned delivery (projection fact,
 * command, outbox row) to a DO. `version`/`payloadHash` drive `decideVersionedApply`;
 * `tombstone` marks a delete-dominant update.
 */
export const VersionedSyncItemSchema = z.object({
  eventId: z.string(),
  version: z.number(),
  payloadHash: z.string(),
  payload: z.unknown(),
  tombstone: z.boolean().optional(),
});
export type VersionedSyncItem = z.infer<typeof VersionedSyncItemSchema>;
