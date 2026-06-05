// Registry schema for auditEvents/{eventId}. Mirrors the structural shape of
// TTTAuditEvent in ../types/audit.ts — which stays the canonical TYPE because it encodes
// compiler-enforced actor/role rules (systemRole required on admin modes, forbidden
// otherwise) that Zod can't express. `type` is validated as a string here; the exact
// ~80-value AuditEventType union remains the source of truth in ../types/audit.ts.

import { z } from 'zod';

const TTTAuditActorSchema = z.discriminatedUnion('actorMode', [
  z.object({
    uid: z.string().nullable(),
    isAdmin: z.boolean(),
    actorMode: z.enum(['user', 'projectMember', 'system']),
  }),
  z.object({
    uid: z.string().nullable(),
    isAdmin: z.boolean(),
    actorMode: z.enum(['adminReview', 'adminOverride']),
    systemRole: z.enum(['admin', 'jrAdmin']),
  }),
]);

const TTTAuditTargetSchema = z.object({
  uid: z.string().nullable(),
  ref: z.string().nullable(),
});

export const TTTAuditEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  schemaVersion: z.number(),
  actor: TTTAuditActorSchema.nullable(),
  target: TTTAuditTargetSchema.nullable(),
  timestamp: z.number(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  region: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  result: z.enum(['success', 'failure']),
  failureReason: z.string().nullable(),
  correlationId: z.string().nullable(),
});
