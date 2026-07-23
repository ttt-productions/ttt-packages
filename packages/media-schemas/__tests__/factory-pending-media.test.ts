import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createPendingMediaSchemas } from '../src/factories/pending-media.js';

describe('createPendingMediaSchemas', () => {
  const fileOriginSchema = z.enum(['origin-a', 'origin-b']);
  const domainEventSchema = z
    .object({
      type: z.literal('test.event'),
      ids: z.object({ id: z.string() }).strict(),
    })
    .strict();

  const schemas = createPendingMediaSchemas({
    fileOriginSchema,
    domainEventSchema,
  });

  it('returns every expected schema', () => {
    expect(schemas.PendingMediaSchema).toBeDefined();
    expect(schemas.PendingMediaPendingSchema).toBeDefined();
    expect(schemas.PendingMediaProcessingSchema).toBeDefined();
    expect(schemas.PendingMediaCompletedSchema).toBeDefined();
    expect(schemas.PendingMediaFailedSchema).toBeDefined();
    expect(schemas.PendingMediaRejectedSchema).toBeDefined();
    expect(schemas.PendingMediaResultSchema).toBeDefined();
    expect(schemas.PendingMediaErrorCategorySchema).toBeDefined();
    expect(schemas.ArchivedPendingMediaSchema).toBeDefined();
  });

  it('parses a valid pending doc with the consumer fileOrigin', () => {
    const doc = {
      id: 'm1',
      userId: 'u1',
      fileOrigin: 'origin-a',
      originalFileName: 'file.jpg',
      pendingStoragePath: 'uploads/origin-a/u1/m1',
      clientContext: { surface: 'test' },
      createdAt: 1,
      updatedAt: 1,
      status: 'pending',
    };
    expect(schemas.PendingMediaSchema.parse(doc).status).toBe('pending');
  });

  it('rejects an unknown fileOrigin', () => {
    const doc = {
      id: 'm1',
      userId: 'u1',
      fileOrigin: 'origin-z',
      originalFileName: 'file.jpg',
      pendingStoragePath: 'uploads/origin-z/u1/m1',
      clientContext: { surface: 'test' },
      createdAt: 1,
      updatedAt: 1,
      status: 'pending',
    };
    expect(() => schemas.PendingMediaSchema.parse(doc)).toThrow();
  });

  it('parses a completed doc carrying domain events of the consumer shape', () => {
    const doc = {
      id: 'm2',
      userId: 'u1',
      fileOrigin: 'origin-a',
      originalFileName: 'file.jpg',
      pendingStoragePath: 'uploads/origin-a/u1/m2',
      clientContext: { surface: 'test' },
      createdAt: 1,
      updatedAt: 2,
      status: 'completed',
      completedAt: 2,
      terminalAt: 2,
      result: {
        events: [{ type: 'test.event', ids: { id: 'x' } }],
      },
    };
    const parsed = schemas.PendingMediaSchema.parse(doc);
    expect(parsed.status).toBe('completed');
  });

  it('rejects an event that does not match the consumer domainEventSchema', () => {
    const doc = {
      id: 'm3',
      userId: 'u1',
      fileOrigin: 'origin-a',
      originalFileName: 'file.jpg',
      pendingStoragePath: 'uploads/origin-a/u1/m3',
      clientContext: { surface: 'test' },
      createdAt: 1,
      updatedAt: 2,
      status: 'completed',
      completedAt: 2,
      terminalAt: 2,
      result: {
        events: [{ type: 'unknown.event', ids: { id: 'x' } }],
      },
    };
    expect(() => schemas.PendingMediaSchema.parse(doc)).toThrow();
  });

  describe('processing attempt/lease crash-recovery fields', () => {
    const baseLive = {
      id: 'm1',
      userId: 'u1',
      fileOrigin: 'origin-a' as const,
      originalFileName: 'file.jpg',
      pendingStoragePath: 'uploads/origin-a/u1/m1',
      clientContext: { surface: 'test' },
      createdAt: 1,
      updatedAt: 1,
    };

    it('parses a legacy pending row with neither new field', () => {
      const parsed = schemas.PendingMediaSchema.parse({ ...baseLive, status: 'pending' });
      expect(parsed.processingAttemptCount).toBeUndefined();
      expect(parsed.processingLeaseExpiresAt).toBeUndefined();
    });

    it('parses processing attempt 1 with a future lease', () => {
      const parsed = schemas.PendingMediaSchema.parse({
        ...baseLive,
        status: 'processing',
        processingStartedAt: 10,
        processingAttemptCount: 1,
        processingLeaseExpiresAt: 10_000,
      });
      expect(parsed.status).toBe('processing');
      if (parsed.status !== 'processing') throw new Error('expected processing');
      expect(parsed.processingAttemptCount).toBe(1);
      expect(parsed.processingLeaseExpiresAt).toBe(10_000);
    });

    it('parses processing attempt 2 with an expired lease', () => {
      const parsed = schemas.PendingMediaSchema.parse({
        ...baseLive,
        status: 'processing',
        processingStartedAt: 5,
        processingAttemptCount: 2,
        processingLeaseExpiresAt: 6,
      });
      if (parsed.status !== 'processing') throw new Error('expected processing');
      expect(parsed.processingAttemptCount).toBe(2);
    });

    it('parses terminal rows carrying historical attempt fields', () => {
      const failed = schemas.PendingMediaSchema.parse({
        ...baseLive,
        status: 'failed',
        failedAt: 20,
        terminalAt: 20,
        errorCategory: 'system',
        errorMessage: 'processing could not finish',
        processingAttemptCount: 2,
        processingLeaseExpiresAt: 15,
      });
      if (failed.status !== 'failed') throw new Error('expected failed');
      expect(failed.processingAttemptCount).toBe(2);
    });

    it('parses archive rows carrying historical attempt fields', () => {
      const archived = schemas.ArchivedPendingMediaSchema.parse({
        ...baseLive,
        status: 'failed',
        failedAt: 20,
        terminalAt: 20,
        archivedAt: 30,
        errorCategory: 'system',
        errorMessage: 'processing could not finish',
        processingAttemptCount: 2,
        processingLeaseExpiresAt: 15,
      });
      if (archived.status !== 'failed') throw new Error('expected failed');
      expect(archived.processingAttemptCount).toBe(2);
    });

    it('rejects a negative attempt count', () => {
      expect(() =>
        schemas.PendingMediaSchema.parse({
          ...baseLive,
          status: 'processing',
          processingAttemptCount: -1,
        }),
      ).toThrow();
    });

    it('rejects a fractional attempt count', () => {
      expect(() =>
        schemas.PendingMediaSchema.parse({
          ...baseLive,
          status: 'processing',
          processingAttemptCount: 1.5,
        }),
      ).toThrow();
    });

    it('rejects a string lease value', () => {
      expect(() =>
        schemas.PendingMediaSchema.parse({
          ...baseLive,
          status: 'processing',
          processingLeaseExpiresAt: '10000',
        }),
      ).toThrow();
    });

    it('rejects a null lease value', () => {
      expect(() =>
        schemas.PendingMediaSchema.parse({
          ...baseLive,
          status: 'processing',
          processingLeaseExpiresAt: null,
        }),
      ).toThrow();
    });

    it('retains strict rejection of unrelated unknown fields', () => {
      expect(() =>
        schemas.PendingMediaSchema.parse({
          ...baseLive,
          status: 'pending',
          processingAttemptCount: 1,
          somethingUnknown: true,
        }),
      ).toThrow();
    });
  });
});
