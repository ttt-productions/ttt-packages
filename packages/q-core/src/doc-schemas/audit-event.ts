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
  z
    .object({
      uid: userIdSchema.nullable(),
      isAdmin: z.boolean(),
      actorMode: z.enum(AUDIT_NON_ADMIN_ACTOR_MODE_KEYS),
    })
    .strict(),
  z
    .object({
      uid: userIdSchema.nullable(),
      isAdmin: z.boolean(),
      actorMode: z.enum(AUDIT_ADMIN_ACTOR_MODE_KEYS),
      systemRole: systemRoleSchema,
    })
    .strict(),
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
  metadata: z.record(z.string(), z.unknown()),
  result: z.enum(AUDIT_RESULT_KEYS),
  failureReason: z.string().nullable(),
  correlationId: z.string().nullable(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;
