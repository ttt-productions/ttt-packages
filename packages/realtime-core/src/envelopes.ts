import { z } from 'zod';

export const RealtimeMessageEnvelopeSchema = z.object({
  v: z.number(),
  kind: z.string(),
  seq: z.number().optional(),
  ackSeq: z.number().optional(),
  clientMessageId: z.string().optional(),
  payload: z.unknown(),
});
export type RealtimeMessageEnvelope = z.infer<typeof RealtimeMessageEnvelopeSchema>;

export const VersionedSyncItemSchema = z.object({
  eventId: z.string(),
  version: z.number(),
  payloadHash: z.string(),
  payload: z.unknown(),
  tombstone: z.boolean().optional(),
});
export type VersionedSyncItem = z.infer<typeof VersionedSyncItemSchema>;
