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
});
