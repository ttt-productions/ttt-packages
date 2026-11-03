import { z } from 'zod';
import { STATS_JOB_KIND_KEYS, STATS_JOB_STAGE_KEYS, STATS_JOB_STATE_KEYS } from '../types/stats.js';
import {
  countSchema,
  epochMsSchema,
  statsValidationReportIdSchema,
  userIdSchema,
} from './atoms.js';
import { FirestoreTimestampSchema } from './firestore-primitives.js';

export const StatsJobSchema = z.object({
  jobId: z.string().min(1),
  kind: z.enum(STATS_JOB_KIND_KEYS),
  userId: userIdSchema,
  state: z.enum(STATS_JOB_STATE_KEYS),
  stage: z.enum(STATS_JOB_STAGE_KEYS),
  cursor: z.string().min(1).nullable(),
  stageDone: countSchema,
  changed: countSchema,
  reportId: statsValidationReportIdSchema.optional(),
  revision: countSchema,
  error: z.string().nullable(),
  attemptCount: countSchema,
  nextAttemptAt: epochMsSchema,
  deadLettered: z.boolean(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
  completedAt: epochMsSchema.nullable(),
  deadLetteredAt: epochMsSchema.nullable(),
  expireAt: FirestoreTimestampSchema.optional(),
});
export type StatsJob = z.infer<typeof StatsJobSchema>;
