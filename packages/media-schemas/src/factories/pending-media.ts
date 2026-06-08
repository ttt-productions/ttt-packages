import { z } from "zod";
import { ClientContextSchema } from "../schemas.js";

export function createPendingMediaSchemas<
  TFileOriginSchema extends z.ZodTypeAny,
  TDomainEventSchema extends z.ZodTypeAny,
>(deps: {
  fileOriginSchema: TFileOriginSchema;
  domainEventSchema: TDomainEventSchema;
}) {
  const { fileOriginSchema, domainEventSchema } = deps;

  const PendingMediaErrorCategorySchema = z.enum([
    'system',
    'rate_limit',
    'validation',
    'kind_mismatch',
    'storage',
    'moderation',
  ]);

  const PendingMediaResultSchema = z
    .object({
      events: z.array(domainEventSchema),
      affected: z
        .array(
          z
            .object({
              collection: z.string().min(1),
              docId: z.string().min(1),
              operation: z.enum(['create', 'update']),
            })
            .strict(),
        )
        .optional(),
    })
    .strict();

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
    clientContext: ClientContextSchema,
    createdAt: z.number(),
    updatedAt: z.number(),
    processingStartedAt: z.number().optional(),
    terminalAt: z.number().optional(),
  } as const;

  const PendingMediaPendingSchema = z
    .object({ ...PendingMediaBaseShape, status: z.literal('pending') })
    .strict();

  const PendingMediaProcessingSchema = z
    .object({ ...PendingMediaBaseShape, status: z.literal('processing') })
    .strict();

  const PendingMediaCompletedSchema = z
    .object({
      ...PendingMediaBaseShape,
      status: z.literal('completed'),
      completedAt: z.number(),
      terminalAt: z.number(),
      uploadTrayClearedAt: z.number().optional(),
      uploadTrayClearedBy: z.string().min(1).optional(),
      uploadTraySeenAt: z.number().optional(),
      uploadTraySeenBy: z.string().min(1).optional(),
      result: PendingMediaResultSchema,
    })
    .strict();

  const PendingMediaFailedSchema = z
    .object({
      ...PendingMediaBaseShape,
      status: z.literal('failed'),
      failedAt: z.number(),
      terminalAt: z.number(),
      uploadTrayClearedAt: z.number().optional(),
      uploadTrayClearedBy: z.string().min(1).optional(),
      uploadTraySeenAt: z.number().optional(),
      uploadTraySeenBy: z.string().min(1).optional(),
      errorCategory: PendingMediaErrorCategorySchema,
      errorMessage: z.string().min(1),
    })
    .strict();

  const PendingMediaRejectedSchema = z
    .object({
      ...PendingMediaBaseShape,
      status: z.literal('rejected'),
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
    })
    .strict();

  const PendingMediaSchema = z.discriminatedUnion('status', [
    PendingMediaPendingSchema,
    PendingMediaProcessingSchema,
    PendingMediaCompletedSchema,
    PendingMediaFailedSchema,
    PendingMediaRejectedSchema,
  ]);

  const ArchivedPendingMediaCompletedSchema = z
    .object({
      ...PendingMediaBaseShape,
      status: z.literal('completed'),
      completedAt: z.number(),
      terminalAt: z.number(),
      uploadTrayClearedAt: z.number().optional(),
      uploadTrayClearedBy: z.string().min(1).optional(),
      uploadTraySeenAt: z.number().optional(),
      uploadTraySeenBy: z.string().min(1).optional(),
      result: PendingMediaResultSchema,
      archivedAt: z.number(),
    })
    .strict();

  const ArchivedPendingMediaFailedSchema = z
    .object({
      ...PendingMediaBaseShape,
      status: z.literal('failed'),
      failedAt: z.number(),
      terminalAt: z.number(),
      uploadTrayClearedAt: z.number().optional(),
      uploadTrayClearedBy: z.string().min(1).optional(),
      uploadTraySeenAt: z.number().optional(),
      uploadTraySeenBy: z.string().min(1).optional(),
      errorCategory: PendingMediaErrorCategorySchema,
      errorMessage: z.string().min(1),
      archivedAt: z.number(),
    })
    .strict();

  const ArchivedPendingMediaRejectedSchema = z
    .object({
      ...PendingMediaBaseShape,
      status: z.literal('rejected'),
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
    })
    .strict();

  const ArchivedPendingMediaSchema = z.discriminatedUnion('status', [
    ArchivedPendingMediaCompletedSchema,
    ArchivedPendingMediaFailedSchema,
    ArchivedPendingMediaRejectedSchema,
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
  };
}

export type PendingMediaSchemas<
  TFileOriginSchema extends z.ZodTypeAny,
  TDomainEventSchema extends z.ZodTypeAny,
> = ReturnType<typeof createPendingMediaSchemas<TFileOriginSchema, TDomainEventSchema>>;
