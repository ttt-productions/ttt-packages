// `auditEvents/{auditEventId}` — the append-only record of sensitive actions and their rejected
// attempts (BACKEND-202..205). Written only by Cloud Functions through the audit writer, in the
// same transaction or batch as the action it records; no client reads or writes it.
//
// The envelope is `@ttt-productions/audit-core`'s `AuditEvent`; Q-Sports supplies the event-type
// union and the actor / target shapes. The admin modes carry the global role they acted with and the
// others carry none (BACKEND-205).

import { z } from 'zod';
import {
  AUDIT_ADMIN_ACTOR_MODE_KEYS,
  AUDIT_EVENT_TYPE_KEYS,
  AUDIT_NON_ADMIN_ACTOR_MODE_KEYS,
  AUDIT_RESULT_KEYS,
} from '../types/audit.js';
import { epochMsSchema, systemRoleSchema, userIdSchema } from './atoms.js';

export const auditEventTypeSchema = z.enum(AUDIT_EVENT_TYPE_KEYS);

export const AuditActorSchema = z.discriminatedUnion('actorMode', [
  z.object({
    uid: userIdSchema.nullable(),
    isAdmin: z.boolean(),
    actorMode: z.enum(AUDIT_NON_ADMIN_ACTOR_MODE_KEYS),
  }).strict(),
  z.object({
    uid: userIdSchema.nullable(),
    isAdmin: z.boolean(),
    actorMode: z.enum(AUDIT_ADMIN_ACTOR_MODE_KEYS),
    systemRole: systemRoleSchema,
  }).strict(),
]);

export const AuditTargetSchema = z.object({
  uid: userIdSchema.nullable(),
  ref: z.string().nullable(),
});

export const AuditEventSchema = z.object({
  id: z.string().min(1),
  type: auditEventTypeSchema,
  schemaVersion: z.number().int().positive(),
  actor: AuditActorSchema.nullable(),
  target: AuditTargetSchema.nullable(),
  timestamp: epochMsSchema,
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  region: z.string().nullable(),
  // Event-specific facts: prior and new values, the role changed, a repair's reason.
  metadata: z.record(z.string(), z.unknown()),
  result: z.enum(AUDIT_RESULT_KEYS),
  failureReason: z.string().nullable(),
  correlationId: z.string().nullable(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;
