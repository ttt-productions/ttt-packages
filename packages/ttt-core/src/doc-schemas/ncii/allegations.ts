import { z } from 'zod';
import { TargetLocatorV1Schema } from '../safety/foundation.js';
import { ResolvedReportTargetV1Schema } from '../safety/report.js';

export const NciiAllegationReporterTypeSchema = z.enum([
  'authenticatedUser',
  'anonymousPublic',
  'operator',
]);
export type NciiAllegationReporterType = z.infer<typeof NciiAllegationReporterTypeSchema>;

export const NciiAllegationStatusSchema = z.enum(['received', 'linked', 'dismissed', 'escalated']);
export type NciiAllegationStatus = z.infer<typeof NciiAllegationStatusSchema>;

export const NciiAllegationV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    allegationId: z.string().min(1),
    caseId: z.string().min(1).optional(),
    reporterType: NciiAllegationReporterTypeSchema,
    submittedAt: z.number(),
    targetLocator: TargetLocatorV1Schema,
    allegationReason: z.string(),
    status: NciiAllegationStatusSchema,
    resolvedTarget: ResolvedReportTargetV1Schema.optional(),
  })
  .strict();
export type NciiAllegationV1 = z.infer<typeof NciiAllegationV1Schema>;
