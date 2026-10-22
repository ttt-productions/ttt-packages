import { z } from 'zod';

export const SafetySlaMonitorKindSchema = z.enum([
  'photoDnaContract',
  'actualKnowledgeUnreported',
  'ncmecRetry',
  'quarantineStall',
  'evidenceStall',
  'accountActionPending',
  'nciiRemovalDeadline',
]);
export type SafetySlaMonitorKind = z.infer<typeof SafetySlaMonitorKindSchema>;

export const SafetySlaMonitorStageSchema = z.enum(['provisional', 'binding']);
export type SafetySlaMonitorStage = z.infer<typeof SafetySlaMonitorStageSchema>;

export const SafetySlaMonitorStatusSchema = z.enum(['armed', 'overdue', 'resolved']);
export type SafetySlaMonitorStatus = z.infer<typeof SafetySlaMonitorStatusSchema>;

export const SafetySlaMonitorV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1).optional(),
    requestId: z.string().min(1).optional(),
    monitorKind: SafetySlaMonitorKindSchema,
    armedAt: z.number(),
    deadlineAt: z.number(),
    escalationLevel: z.number(),
    lastFiredAt: z.number().optional(),
    monitorStage: SafetySlaMonitorStageSchema.optional(),
    basisSubmissionId: z.string().min(1).optional(),
    status: SafetySlaMonitorStatusSchema,
    resolvedAt: z.number().optional(),
    resolutionBasis: z.string().optional(),
  })
  .strict();
export type SafetySlaMonitorV1 = z.infer<typeof SafetySlaMonitorV1Schema>;

export const SafetyMonitorHeartbeatV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    lastRunAt: z.number(),
    expectedIntervalMs: z.number(),
  })
  .strict();
export type SafetyMonitorHeartbeatV1 = z.infer<typeof SafetyMonitorHeartbeatV1Schema>;
