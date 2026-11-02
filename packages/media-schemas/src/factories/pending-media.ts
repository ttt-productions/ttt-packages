import { z } from 'zod';
import {
  ClientContextSchema,
  ClientMediaClaimSchema,
  MediaPublicationStateSchema,
} from '../schemas.js';

export const PendingMediaStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'rejected',
]);
const STATUS = PendingMediaStatusSchema.enum;

export function createPendingMediaSchemas<
  TFileOriginSchema extends z.ZodTypeAny,
  TDomainEventSchema extends z.ZodTypeAny,
>(deps: { fileOriginSchema: TFileOriginSchema; domainEventSchema: TDomainEventSchema }) {
  const { fileOriginSchema, domainEventSchema } = deps;

  const PendingMediaErrorCategorySchema = z.enum([
    'system',
    'rate_limit',
    'validation',
    'kind_mismatch',
    'storage',
    'moderation',
  ]);

  const PendingMediaResultSchema = z.object({
    events: z.array(domainEventSchema),
    affected: z
      .array(
        z.object({
          collection: z.string().min(1),
          docId: z.string().min(1),
          operation: z.enum(['create', 'update']),
        }),
      )
      .optional(),
  });

  const PendingMediaBaseShape = {
    id: z.string().min(1),
    userId: z.string().min(1),
    fileOrigin: fileOriginSchema,
    originalFileName: z.string().min(1),
    originalContentType: z.string().optional(),
    originalSize: z.number().optional(),
    pendingStoragePath: z.string().min(1),
    targetInfo: z.unknown().optional(),
    textContent: z.string().optional(),
    // The client sends these strict (RULE-STD-BACKEND-002); the stored copy reads plain.
    clientContext: ClientContextSchema.strip(),
    clientMediaClaim: ClientMediaClaimSchema.strip().optional(),
    publicationState: MediaPublicationStateSchema.optional(),
    moderationOverride: z.string().min(1).optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    processingStartedAt: z.number().optional(),
    processingAttemptCount: z.number().int().min(0).optional(),
    processingLeaseExpiresAt: z.number().optional(),
    terminalAt: z.number().optional(),
  } as const;

  const PendingMediaPendingSchema = z.object({
    ...PendingMediaBaseShape,
    status: z.literal(STATUS.pending),
  });

  const PendingMediaProcessingSchema = z.object({
    ...PendingMediaBaseShape,
    status: z.literal(STATUS.processing),
    processingStartedAt: z.number(),
    processingAttemptCount: z.number().int().min(1),
    processingLeaseExpiresAt: z.number(),
  });

  const PendingMediaCompletedSchema = z.object({
    ...PendingMediaBaseShape,
    status: z.literal(STATUS.completed),
    completedAt: z.number(),
    terminalAt: z.number(),
    uploadTrayClearedAt: z.number().optional(),
    uploadTrayClearedBy: z.string().min(1).optional(),
    uploadTraySeenAt: z.number().optional(),
    uploadTraySeenBy: z.string().min(1).optional(),
    result: PendingMediaResultSchema,
  });

  const PendingMediaFailedSchema = z.object({
    ...PendingMediaBaseShape,
    status: z.literal(STATUS.failed),
    failedAt: z.number(),
    terminalAt: z.number(),
    uploadTrayClearedAt: z.number().optional(),
    uploadTrayClearedBy: z.string().min(1).optional(),
    uploadTraySeenAt: z.number().optional(),
    uploadTraySeenBy: z.string().min(1).optional(),
    errorCategory: PendingMediaErrorCategorySchema,
    errorMessage: z.string().min(1),
  });

  const PendingMediaRejectedSchema = z.object({
    ...PendingMediaBaseShape,
    status: z.literal(STATUS.rejected),
    rejectedAt: z.number(),
    terminalAt: z.number(),
    uploadTrayClearedAt: z.number().optional(),
    uploadTrayClearedBy: z.string().min(1).optional(),
    uploadTraySeenAt: z.number().optional(),
    uploadTraySeenBy: z.string().min(1).optional(),
    rejectionType: z.enum(['text', 'media']),
    errorMessage: z.string().min(1),
    violationId: z.string().min(1).optional(),
    result: PendingMediaResultSchema.optional(),
  });

  const PendingMediaSchema = z.discriminatedUnion('status', [
    PendingMediaPendingSchema,
    PendingMediaProcessingSchema,
    PendingMediaCompletedSchema,
    PendingMediaFailedSchema,
    PendingMediaRejectedSchema,
  ]);

  const ArchivedPendingMediaCompletedSchema = z.object({
    ...PendingMediaBaseShape,
    status: z.literal(STATUS.completed),
    completedAt: z.number(),
    terminalAt: z.number(),
    uploadTrayClearedAt: z.number().optional(),
    uploadTrayClearedBy: z.string().min(1).optional(),
    uploadTraySeenAt: z.number().optional(),
    uploadTraySeenBy: z.string().min(1).optional(),
    result: PendingMediaResultSchema,
    archivedAt: z.number(),
  });

  const ArchivedPendingMediaFailedSchema = z.object({
    ...PendingMediaBaseShape,
    status: z.literal(STATUS.failed),
    failedAt: z.number(),
    terminalAt: z.number(),
    uploadTrayClearedAt: z.number().optional(),
    uploadTrayClearedBy: z.string().min(1).optional(),
    uploadTraySeenAt: z.number().optional(),
    uploadTraySeenBy: z.string().min(1).optional(),
    errorCategory: PendingMediaErrorCategorySchema,
    errorMessage: z.string().min(1),
    archivedAt: z.number(),
  });

  const ArchivedPendingMediaRejectedSchema = z.object({
    ...PendingMediaBaseShape,
    status: z.literal(STATUS.rejected),
    rejectedAt: z.number(),
    terminalAt: z.number(),
    uploadTrayClearedAt: z.number().optional(),
    uploadTrayClearedBy: z.string().min(1).optional(),
    uploadTraySeenAt: z.number().optional(),
    uploadTraySeenBy: z.string().min(1).optional(),
    rejectionType: z.enum(['text', 'media']),
    errorMessage: z.string().min(1),
    violationId: z.string().min(1).optional(),
    result: PendingMediaResultSchema.optional(),
    archivedAt: z.number(),
  });

  const ArchivedPendingMediaSchema = z.discriminatedUnion('status', [
    ArchivedPendingMediaCompletedSchema,
    ArchivedPendingMediaFailedSchema,
    ArchivedPendingMediaRejectedSchema,
  ]);

  const ArchivedPendingMediaQuarantinedSchema = z.object({
    parseFailed: z.literal(true),
    archivedAt: z.number(),
    raw: z.record(z.string(), z.unknown()),
  });

  const ArchivedPendingMediaDocSchema = z.union([
    ArchivedPendingMediaSchema,
    ArchivedPendingMediaQuarantinedSchema,
  ]);

  return {
    PendingMediaErrorCategorySchema,
    PendingMediaResultSchema,
    PendingMediaPendingSchema,
    PendingMediaProcessingSchema,
    PendingMediaCompletedSchema,
    PendingMediaFailedSchema,
    PendingMediaRejectedSchema,
    PendingMediaSchema,
    ArchivedPendingMediaCompletedSchema,
    ArchivedPendingMediaFailedSchema,
    ArchivedPendingMediaRejectedSchema,
    ArchivedPendingMediaSchema,
    ArchivedPendingMediaQuarantinedSchema,
    ArchivedPendingMediaDocSchema,
  };
}

export type PendingMediaSchemas<
  TFileOriginSchema extends z.ZodTypeAny,
  TDomainEventSchema extends z.ZodTypeAny,
> = ReturnType<typeof createPendingMediaSchemas<TFileOriginSchema, TDomainEventSchema>>;
