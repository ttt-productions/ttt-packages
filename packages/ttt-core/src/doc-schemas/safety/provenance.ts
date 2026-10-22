import { z } from 'zod';

export const EventProvenanceKindSchema = z.enum([
  'uploadInit',
  'uploadFinalize',
  'messageSend',
  'reportSubmit',
]);
export type EventProvenanceKind = z.infer<typeof EventProvenanceKindSchema>;

export const EventProvenanceRetentionClassSchema = z.enum(['routine', 'casePromoted']);
export type EventProvenanceRetentionClass = z.infer<typeof EventProvenanceRetentionClassSchema>;

export const EventProvenanceSubjectRefsSchema = z
  .object({
    uid: z.string().min(1).optional(),
    assetId: z.string().min(1).optional(),
    channelId: z.string().min(1).optional(),
    messageSeq: z.number().optional(),
    reportId: z.string().min(1).optional(),
  })
  .strict();
export type EventProvenanceSubjectRefs = z.infer<typeof EventProvenanceSubjectRefsSchema>;

export const EventProvenanceV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    kind: EventProvenanceKindSchema,
    subjectRefs: EventProvenanceSubjectRefsSchema,
    trustedClientIp: z.string(),
    userAgent: z.string().max(256),
    at: z.number(),
    sessionId: z.string(),
    retentionClass: EventProvenanceRetentionClassSchema,
  })
  .strict();
export type EventProvenanceV1 = z.infer<typeof EventProvenanceV1Schema>;

export const EVENT_PROVENANCE_ROUTINE_TTL_DAYS = {
  uploadInit: 90,
  uploadFinalize: 90,
  messageSend: 90,
} as const;
